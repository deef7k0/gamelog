import { useEffect } from 'react';
import {
  SensorType,
  useAnimatedReaction,
  useAnimatedSensor,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/** How far the phone turns, in radians, to swing the light all the way: about 24°. */
const RANGE = 0.42;
/** How quickly the light follows the phone: each reading closes this much of the gap. */
const FOLLOW = 0.2;
/**
 * How quickly "level" catches up with how the phone is being held.
 *
 * Whatever angle the phone settles at becomes the new neutral over a few
 * seconds, so the light comes back to rest on its own and a reader who shifts
 * in their seat is not left with the lamp pinned to one side.
 */
const RECENTRE = 0.004;

/**
 * The phone as the hand holding the copy: its tilt, written into two shared
 * values the stage lights itself by.
 *
 * Renders nothing. **Mounted only while it should be listening** — the stage
 * unmounts it when the screen is not in front, the stage is scrolled away, the
 * keyboard is up or Reduce Motion is on — and mounting is what registers the
 * sensor, so that is also what stops it.
 *
 * ## No new native module
 *
 * Reanimated reads the device's sensors itself (`useAnimatedSensor`), on the UI
 * thread, and Reanimated is already in every build and in Expo Go. `expo-sensors`
 * would have been a second way to ask the same question, at a native module's
 * full size (CLAUDE.md § APK size).
 *
 * ## Why the rotation sensor, and why quaternions
 *
 * Gravity alone cannot see a phone held upright being turned like a door, which
 * is exactly the turn that should swing a light across a case. The rotation
 * vector sees every turn. Its Euler angles are useless for this — held upright
 * a phone sits on their singularity, where roll and yaw trade places — so the
 * tilt is read from the quaternion directly: the rotation that carries the
 * phone from where it was level to where it is now, whose `x` and `y` parts
 * are, for a small turn, half the angle about each of the phone's own axes.
 *
 * The sign each platform gives a turn is not something this can be told from
 * here, and it does not need to be: either way the light moves when the phone
 * does, and comes back when it stops.
 */
export function StageTilt({
  tiltX,
  tiltY,
}: {
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
}) {
  const rotation = useAnimatedSensor(SensorType.ROTATION);

  /* Where the phone counts as level: a quaternion, and whether one is held yet. */
  const levelW = useSharedValue(1);
  const levelX = useSharedValue(0);
  const levelY = useSharedValue(0);
  const levelZ = useSharedValue(0);
  const levelled = useSharedValue(false);

  useAnimatedReaction(
    () => rotation.sensor.get(),
    (now) => {
      const { qw, qx, qy, qz } = now;
      /* No reading yet, or a device with no such sensor: it answers zeros. */
      if (qw === 0 && qx === 0 && qy === 0 && qz === 0) return;

      if (!levelled.get()) {
        levelW.set(qw);
        levelX.set(qx);
        levelY.set(qy);
        levelZ.set(qz);
        levelled.set(true);
        return;
      }

      const w = levelW.get();
      const x = levelX.get();
      const y = levelY.get();
      const z = levelZ.get();

      /* level⁻¹ · now: the turn since level, in the phone's own frame. */
      let turnW = w * qw + x * qx + y * qy + z * qz;
      let turnX = w * qx - x * qw - y * qz + z * qy;
      let turnY = w * qy + x * qz - y * qw - z * qx;
      /* q and -q are the same rotation; take the short way round. */
      if (turnW < 0) {
        turnW = -turnW;
        turnX = -turnX;
        turnY = -turnY;
      }

      const wantX = Math.max(-1, Math.min(1, (2 * turnY) / RANGE));
      const wantY = Math.max(-1, Math.min(1, (2 * turnX) / RANGE));
      tiltX.set(tiltX.get() + (wantX - tiltX.get()) * FOLLOW);
      tiltY.set(tiltY.get() + (wantY - tiltY.get()) * FOLLOW);

      /* Level drifts toward now. Renormalised, since a blend of two unit
         quaternions is a little short of one. */
      const side = w * qw + x * qx + y * qy + z * qz < 0 ? -1 : 1;
      const nextW = w + (side * qw - w) * RECENTRE;
      const nextX = x + (side * qx - x) * RECENTRE;
      const nextY = y + (side * qy - y) * RECENTRE;
      const nextZ = z + (side * qz - z) * RECENTRE;
      const length = Math.hypot(nextW, nextX, nextY, nextZ) || 1;
      levelW.set(nextW / length);
      levelX.set(nextX / length);
      levelY.set(nextY / length);
      levelZ.set(nextZ / length);
    }
  );

  /* Stopped listening: the light goes back to rest, it is not left where it was. */
  useEffect(
    () => () => {
      tiltX.set(withTiming(0, { duration: 420 }));
      tiltY.set(withTiming(0, { duration: 420 }));
    },
    [tiltX, tiltY]
  );

  return null;
}

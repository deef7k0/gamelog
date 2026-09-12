import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
/*
 * A raw `Text`, not the app's `<Text variant>`.
 *
 * Every string on this face is printing on an object and is sized from the
 * case's width, which is precisely what the variant scale exists to prevent
 * elsewhere. Importing the primitive and then overriding its size on every call
 * would be the same literals with a misleading wrapper around them.
 */
import { StyleSheet, Text, View } from 'react-native';

import {
  CASE_TEMPLATES,
  CASE_TEMPLATE_SIZE,
  PLATFORMS,
  hasCase,
  type PlatformKey,
} from '@/constants/platform-cases';
import { labelFor, scoreColor } from '@/constants/score';
import { STATUS_ICON, STATUS_LABEL, statusColor } from '@/constants/status';
import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GameLog } from '@/lib/database.types';

/**
 * The printed back of the case.
 *
 * The front is the publisher's — their art, their branding, their edition badge.
 * **The back is yours.** It prints the one thing no storefront can: that you
 * played this, what you made of it, on what, and whether you took it all the
 * way. That split is the whole idea, and it is why this surface exists at all
 * rather than the record living in another card on the page.
 *
 * Nothing here is the *only* copy of that data — the same status, score and
 * platinum render at full interface size in the page's own log block a few
 * hundred pixels below. This is a second, physical presentation of facts that
 * are already legible elsewhere, which is what licenses the small printed type
 * below the app's 10px floor (see `SIZES`).
 *
 * Renders nothing of its own for a game with no case: `<GameCaseFlip>` only
 * mounts it for a console platform, since a PC game's stand-in cover has no
 * back to turn over.
 */

/**
 * Case material. Literals on purpose, exactly as in `game-case.tsx`.
 *
 * The case is the one depicted *physical object* in the app, so its material is
 * not part of the interface palette — a token in `Colors.dark` would invite a
 * future retheme to move it, and this has to keep matching a PNG that will not
 * move. Same reasoning that keeps the front's shadow, gloss and edition ink as
 * literals in its own file.
 *
 * Verified against every foreground this surface uses: worst case is
 * `scoreLow` on the lightest stop at 5.28:1, and white on Switch red at 4.80:1.
 * All clear AA.
 */
const PLASTIC = {
  top: '#17181A',
  bottom: '#0E0F11',
  /** The moulded lip where the back face meets the edge. */
  rule: 'rgba(255,255,255,0.07)',
  /** Catches the light along the top edge, the way a matte shell does. */
  highlight: 'rgba(255,255,255,0.10)',
} as const;

/**
 * Type and geometry as fractions of the rendered width.
 *
 * The case is a printed object, so nothing here rides `Spacing` or `Type` — the
 * same rule that pins the front's edition badge. Every value is derived from
 * the width so the back stays proportional at any size the caller asks for, and
 * each carries a dp floor so it never collapses on a narrow phone.
 *
 * The floors sit below the interface's 10px minimum, and that is deliberate:
 * this is *printing on a depicted object*, read the way you read the back of a
 * real box. It is licensed by everything here existing twice — every fact is
 * announced in full by `<GameCaseFlip>`'s accessibility label, and the status,
 * score and review all render at interface size further down the same page.
 */
const SIZES = {
  pad: (w: number) => Math.round(w * 0.072),
  band: (w: number) => Math.round(w * 0.125),
  bandLabel: (w: number) => Math.max(7, w * 0.05),
  statusGlyph: (w: number) => Math.max(10, Math.round(w * 0.078)),
  statusWord: (w: number) => Math.max(9, w * 0.068),
  /* The blurb. A real back cover leads with the pull quote, so the reviewer's
     own headline is the largest printed thing above the score, and the body
     under it is deliberately smaller than the status word — copy you *can* read
     rather than copy you are meant to. */
  reviewTitle: (w: number) => Math.max(8.5, w * 0.062),
  reviewBody: (w: number) => Math.max(7, w * 0.048),
  score: (w: number) => Math.max(22, w * 0.185),
  verdict: (w: number) => Math.max(7.5, w * 0.052),
  footer: (w: number) => Math.max(7.5, w * 0.052),
  seal: (w: number) => Math.max(16, Math.round(w * 0.13)),
  /** The moulded corner. Smaller than the artwork's, like the real shell. */
  radius: (w: number) => Math.max(3, Math.round(w * 0.025)),
};

export type GameCaseBackProps = {
  /** The platform the case is presented as — drives the branding band. */
  platform: PlatformKey;
  /** The viewer's own log, or null when they have not logged this game. */
  log: GameLog | null;
  /** Rendered width of the face, matching the front exactly. */
  width: number;
};

export function GameCaseBack({ platform, log, width }: GameCaseBackProps) {
  const theme = useTheme();

  const height = (width / CASE_TEMPLATE_SIZE.width) * CASE_TEMPLATE_SIZE.height;
  const pad = SIZES.pad(width);
  const radius = SIZES.radius(width);

  /* The branding band takes the spine's own colour, so the back is unmistakably
     the same object as the front rather than a generic dark card. */
  const meta = PLATFORMS[platform];
  const bandColor = hasCase(platform) ? CASE_TEMPLATES[platform].spineColor : meta.accent;

  const score = log?.rating ?? null;

  return (
    <View style={[styles.shell, { width, height, borderRadius: radius }]}>
      <LinearGradient
        colors={[PLASTIC.top, PLASTIC.bottom]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Branding band, mirroring the printed strip across the front's head. */}
      <View style={[styles.band, { height: SIZES.band(width), backgroundColor: bandColor }]}>
        <View style={[styles.bandHighlight, { backgroundColor: PLASTIC.highlight }]} />
        <Ionicons name={meta.icon} size={SIZES.bandLabel(width) + 2} color="#FFFFFF" />
        <Text style={[styles.bandLabel, { fontSize: SIZES.bandLabel(width) }]} numberOfLines={1}>
          {meta.short}
        </Text>
      </View>

      <View style={[styles.body, { padding: pad }]}>
        {log ? (
          <Record log={log} score={score} width={width} />
        ) : (
          <View style={styles.blank}>
            <Ionicons
              name="ellipse-outline"
              size={SIZES.statusGlyph(width) + 2}
              color={theme.textMuted}
            />
            <Text
              style={[
                styles.blankLabel,
                { fontSize: SIZES.verdict(width), color: theme.textMuted },
              ]}
              numberOfLines={2}>
              NO RECORD YET
            </Text>
          </View>
        )}
      </View>

      {/* The same diagonal sheen the front carries. Copied rather than shared
          because the front holds it as literals inside the protected component;
          the two must stay identical or the object looks like two objects. */}
      <LinearGradient
        colors={['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.9, y: 0.55 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
    </View>
  );
}

/** Everything the viewer put on record, in the order a reader wants it. */
function Record({ log, score, width }: { log: GameLog; score: number | null; width: number }) {
  const theme = useTheme();
  const tint = statusColor(log.status, theme);

  /* Played-on is free text on rows logged before the picker existed, so it is
     shown as typed rather than parsed — the only lie available here would be
     silently correcting someone's own record. */
  const footer = [
    log.played_on?.trim() || null,
    log.hours_played != null ? `${log.hours_played}H` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <View style={styles.record}>
      <View style={styles.statusRow}>
        {/* Glyph as well as hue, for the same reason the page's log block
            carries one: four states told apart by colour alone fails the
            green/rust pair for roughly one man in twelve. */}
        <Ionicons name={STATUS_ICON[log.status]} size={SIZES.statusGlyph(width)} color={tint} />
        <Text
          style={[styles.statusWord, { fontSize: SIZES.statusWord(width), color: tint }]}
          numberOfLines={1}>
          {STATUS_LABEL[log.status].toUpperCase()}
        </Text>

        {/* Platinum reads as a foil seal pressed into the shell — what an award
            badge is on a real back cover. It rides the status row rather than a
            corner of its own: absolutely placed at the foot it sat in the same
            band as the played-on line and the two overlapped, and beside the
            status it also pairs the two facts that are about *what happened*. */}
        {log.platinum && (
          <View
            style={[
              styles.seal,
              {
                width: SIZES.seal(width),
                height: SIZES.seal(width),
                borderRadius: SIZES.seal(width) / 2,
                borderColor: theme.platinum,
              },
            ]}>
            <Ionicons
              name="trophy"
              size={Math.round(SIZES.seal(width) * 0.55)}
              color={theme.platinum}
            />
          </View>
        )}
      </View>

      {/*
        The blurb: the reviewer's headline, then the first couple of lines of
        what they wrote.

        This is what a back cover is *for* — the front sells the game and the
        back quotes somebody on it, except the somebody here is you. Two lines
        of body is the whole budget: enough to carry a voice, short enough that
        it stays printing on an object rather than becoming a card with a
        paragraph in it. The rest is one tap away on the review screen.

        `ellipsizeMode="tail"` and a hard `numberOfLines` rather than a
        character truncation, so the cut lands on the rendered line box at
        whatever width the caller asked for.
      */}
      {(log.review_title?.trim() || log.review?.trim()) && (
        <View style={styles.blurb}>
          {log.review_title?.trim() && (
            <Text
              style={[
                styles.reviewTitle,
                { fontSize: SIZES.reviewTitle(width), color: theme.text },
              ]}
              numberOfLines={2}
              ellipsizeMode="tail">
              {log.review_title.trim()}
            </Text>
          )}

          {log.review?.trim() && (
            <Text
              style={[
                styles.reviewBody,
                { fontSize: SIZES.reviewBody(width), color: theme.textSecondary },
              ]}
              numberOfLines={2}
              ellipsizeMode="tail">
              {log.review.trim()}
            </Text>
          )}
        </View>
      )}

      {score !== null && (
        <View style={styles.scoreBlock}>
          <Text
            style={[
              styles.score,
              { fontSize: SIZES.score(width), color: scoreColor(score, theme) },
            ]}>
            {score}
          </Text>
          <Text
            style={[styles.verdict, { fontSize: SIZES.verdict(width), color: theme.textSecondary }]}
            numberOfLines={1}>
            {labelFor(score).toUpperCase()}
          </Text>
        </View>
      )}

      {footer.length > 0 && (
        <View style={[styles.footerRule, { borderTopColor: PLASTIC.rule }]}>
          <Text
            style={[styles.footer, { fontSize: SIZES.footer(width), color: theme.textSecondary }]}
            numberOfLines={1}>
            {footer}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { overflow: 'hidden' },
  band: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
    paddingHorizontal: 6,
  },
  bandHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  bandLabel: {
    color: '#FFFFFF',
    fontFamily: FontFamily.bold,
    letterSpacing: 0.6,
    flexShrink: 1,
  },
  body: { flex: 1 },
  record: { flex: 1, justifyContent: 'flex-start' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusWord: { fontFamily: FontFamily.bold, letterSpacing: 0.5, flexShrink: 1 },
  /* Literals, like every other measurement on this object — see the note on
     `SIZES`. 5 above sets the blurb off from the status row; 2 between the
     headline and its body keeps them one block. */
  blurb: { marginTop: 5, gap: 2 },
  reviewTitle: { fontFamily: FontFamily.bold, letterSpacing: 0.1 },
  reviewBody: { fontFamily: FontFamily.regular, letterSpacing: 0.1 },
  scoreBlock: { marginTop: 'auto' },
  score: { fontFamily: FontFamily.bold, letterSpacing: -0.5 },
  verdict: { fontFamily: FontFamily.medium, letterSpacing: 0.7 },
  footerRule: {
    marginTop: 6,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footer: { fontFamily: FontFamily.medium, letterSpacing: 0.5 },
  blank: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 5 },
  blankLabel: { fontFamily: FontFamily.medium, letterSpacing: 0.7, textAlign: 'center' },
  seal: {
    marginLeft: 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
});

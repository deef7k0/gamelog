import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { SelectField, type SelectOption } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';

/** How far back the year list goes. The first commercial home console is 1972. */
const EARLIEST_YEAR = 1972;

const MONTHS = Array.from({ length: 12 }, (_, index) =>
  new Date(2000, index, 1).toLocaleDateString(undefined, { month: 'long' })
);

export type PartialDateFieldProps = {
  label: string;
  /** '2021', '2021-05', or null. A day, if a stored value has one, is kept. */
  value: string | null;
  onChange: (value: string | null) => void;
};

/**
 * A year, and a month if you remember it.
 *
 * ## Why not a date picker
 *
 * Nobody remembers the day they started a game they played in 2019, and a date
 * picker asks for one anyway — so people pick the 1st, and the record claims a
 * precision it never had. Two choices, the second optional, store exactly what
 * was said: '2019' or '2019-05' (see the partial-date CHECK in 0023). There is
 * no day, on purpose; a stored value that has one keeps it until the month or
 * year is changed.
 *
 * Built from two `<SelectField>`s so it inherits their sheet, their clear row
 * and their accessibility, and adds no new control to the app.
 */
export function PartialDateField({ label, value, onChange }: PartialDateFieldProps) {
  const match = /^(\d{4})(?:-(\d{2}))?/.exec(value ?? '');
  const year = match?.[1] ?? '';
  const month = match?.[2] ?? '';

  const years = useMemo<SelectOption[]>(() => {
    const now = new Date().getFullYear();
    return Array.from({ length: now - EARLIEST_YEAR + 1 }, (_, index) => {
      const text = String(now - index);
      return { value: text, label: text };
    });
  }, []);

  const months = useMemo<SelectOption[]>(
    () =>
      MONTHS.map((name, index) => ({
        value: String(index + 1).padStart(2, '0'),
        label: name,
      })),
    []
  );

  return (
    <View style={styles.field}>
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      <View style={styles.row}>
        <View style={styles.part}>
          <SelectField
            value={year}
            options={years}
            sheetTitle={`${label} — year`}
            placeholder="Year"
            onChange={(next) => onChange(next ? (month ? `${next}-${month}` : next) : null)}
          />
        </View>
        <View style={styles.part}>
          {/* Only once there is a year: a month on its own is not a date. */}
          <SelectField
            value={month}
            options={year ? months : []}
            sheetTitle={`${label} — month`}
            placeholder={year ? 'Any month' : 'Month'}
            hint={year ? undefined : 'Pick a year first'}
            onChange={(next) => onChange(year ? (next ? `${year}-${next}` : year) : null)}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: Spacing.x8 },
  row: { flexDirection: 'row', gap: Spacing.x8 },
  part: { flex: 1 },
});

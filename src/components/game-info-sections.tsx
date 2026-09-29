import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { InfoCard } from '@/components/ui/info-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import type {
  WikidataAward,
  WikidataBudget,
  WikidataCastMember,
  WikidataCredit,
  WikidataGameInfo,
  WikidataPerson,
} from '@/lib/wikidata';

/**
 * Rows shown before a long list folds, and how much longer than that a list
 * has to be before folding is worth a control — a "Show all 9" that reveals
 * one row costs more than the row.
 */
const FOLDED_ROWS = 8;
const FOLD_ABOVE = FOLDED_ROWS + 2;

/**
 * The additional-information screen's sections, in the order they are read.
 *
 * A section exists only when it has something in it: no heading over an empty
 * list, no "Budget: unknown", and no gap where a missing section would have
 * been — the screen's column gap is the only space between cards. Every
 * section is an `<InfoCard>`, the panel the Overview tab is built from, so the
 * screen reads as that tab continued rather than as a page from somewhere else.
 *
 * Everything here is text Wikidata holds, already resolved to labels by
 * `lib/wikidata`; nothing is inferred or filled in.
 */
export function GameInfoSections({ info }: { info: WikidataGameInfo }) {
  return (
    <>
      {info.awards.length > 0 && <AwardsCard title="Awards" awards={info.awards} />}
      {info.nominations.length > 0 && <AwardsCard title="Nominations" awards={info.nominations} />}
      {info.cast.length > 0 && <CastCard cast={info.cast} />}
      {info.budgets.length > 0 && <BudgetCard budgets={info.budgets} />}
      {info.producers.length > 0 && <CreditsCard title="Producers" credits={info.producers} />}
      {info.composers.length > 0 && <CreditsCard title="Composers" credits={info.composers} />}
      {info.designers.length > 0 && <CreditsCard title="Designers" credits={info.designers} />}
      {info.screenwriters.length > 0 && (
        <CreditsCard title="Screenwriters" credits={info.screenwriters} />
      )}
      {info.people.length > 0 && <PeopleCard people={info.people} />}
    </>
  );
}

/** The count beside a list's title, quiet and in the card's own ink — as on Overview. */
function Count({ value }: { value: number }) {
  const accent = useAccent();
  return (
    <Text variant="body" style={{ color: accent.quietInk }}>
      {value}
    </Text>
  );
}

function AwardsCard({ title, awards }: { title: string; awards: WikidataAward[] }) {
  const accent = useAccent();

  return (
    <InfoCard title={title} action={<Count value={awards.length} />}>
      <FoldingRows
        items={awards}
        keyOf={(award) => `${award.id}:${award.year ?? ''}`}
        noun={title.toLowerCase()}
        render={(award) => (
          /* The year to the right, as a column of dates down the card — the
             name is the fact, the year is where to find it. One accessible
             element per row, so a screen reader reads the pair together. */
          <View
            style={styles.split}
            accessible
            accessibilityLabel={award.year ? `${award.name}, ${award.year}` : award.name}>
            <Text variant="body" style={styles.flex}>
              {award.name}
            </Text>
            {award.year !== null && (
              <Text variant="bodySmall" style={{ color: accent.quietInk }}>
                {award.year}
              </Text>
            )}
          </View>
        )}
      />
    </InfoCard>
  );
}

/**
 * Performer on the left, who they played on the right.
 *
 * Two columns rather than "X as Y": the names line up down the card, so it can
 * be read either way — down the actors or down the characters. A performer
 * with no character recorded keeps the row and leaves the right column empty;
 * nothing is written in to fill it.
 */
function CastCard({ cast }: { cast: WikidataCastMember[] }) {
  const accent = useAccent();

  return (
    <InfoCard title="Cast" action={<Count value={cast.length} />}>
      <FoldingRows
        items={cast}
        keyOf={(member) => `${member.id}:${member.dub ?? ''}`}
        noun="cast members"
        render={(member) => {
          const credit = castCredit(member);
          const characters = member.characters.join(', ');
          const spoken = [
            member.name,
            characters ? `as ${characters}` : null,
            credit ? credit.toLowerCase() : null,
          ].filter(Boolean);

          return (
            <View style={styles.split} accessible accessibilityLabel={spoken.join(', ')}>
              <View style={styles.castName}>
                <Text variant="body">{member.name}</Text>
                {credit && (
                  <Text variant="caption" style={{ color: accent.quietInk }}>
                    {credit}
                  </Text>
                )}
              </View>
              <Text variant="body" color="textSecondary" style={styles.flex}>
                {characters}
              </Text>
            </View>
          );
        }}
      />
    </InfoCard>
  );
}

/**
 * The small line under a performer, when their credit is not the plain one.
 *
 * "Voice" only where P725 is the *only* property that credits them — a cast
 * member (P161) who also voiced the part is a cast member. A dub says which
 * language it is, so two actors against one character read as two versions
 * rather than as a duplicate.
 */
function castCredit(member: WikidataCastMember): string | null {
  if (member.dub) return `${member.dub} voice`;
  if (member.voice && !member.cast) return 'Voice';
  return null;
}

/**
 * The figure, and under it what it covers — "a bold figure over a quiet line",
 * the app's shape for a fact. One block per figure: Cyberpunk 2077 records
 * its production and marketing costs as two.
 */
function BudgetCard({ budgets }: { budgets: WikidataBudget[] }) {
  const accent = useAccent();

  return (
    <InfoCard title="Budget">
      <View style={styles.rows}>
        {budgets.map((budget) => {
          const detail = [budget.scope, budget.year].filter((part) => part !== null).join(' · ');
          return (
            <View
              key={`${budget.formatted}:${budget.scope ?? ''}:${budget.year ?? ''}`}
              style={styles.fact}
              accessible
              accessibilityLabel={detail ? `${budget.formatted}, ${detail}` : budget.formatted}>
              <Text variant="h2">{budget.formatted}</Text>
              {detail !== '' && (
                <Text variant="bodySmall" style={{ color: accent.quietInk }}>
                  {detail}
                </Text>
              )}
            </View>
          );
        })}
      </View>
    </InfoCard>
  );
}

/** One role's names, one per line — the shape of the Developers card on Overview. */
function CreditsCard({ title, credits }: { title: string; credits: WikidataCredit[] }) {
  return (
    <InfoCard title={title}>
      <FoldingRows
        items={credits}
        keyOf={(credit) => credit.id}
        noun={title.toLowerCase()}
        render={(credit) => <Text variant="body">{credit.name}</Text>}
      />
    </InfoCard>
  );
}

/**
 * Each person once, with everything they did: "Director · Producer ·
 * Designer · Screenwriter". The role sections above say who held a role; this
 * says what each person did, and a person credited four times is still one
 * row.
 */
function PeopleCard({ people }: { people: WikidataPerson[] }) {
  const accent = useAccent();

  return (
    <InfoCard title="People" action={<Count value={people.length} />}>
      <FoldingRows
        items={people}
        keyOf={(person) => person.id}
        noun="people"
        render={(person) => (
          <View
            style={styles.stacked}
            accessible
            accessibilityLabel={`${person.name}, ${person.roles.join(', ')}`}>
            <Text variant="body">{person.name}</Text>
            <Text variant="bodySmall" style={{ color: accent.quietInk }}>
              {person.roles.join(' · ')}
            </Text>
          </View>
        )}
      />
    </InfoCard>
  );
}

/**
 * A list that folds past `FOLDED_ROWS`, with the control to unfold it.
 *
 * The Witcher 3 has twenty nominations and Overwatch thirty-nine voice
 * credits; printed in full, one section would push every other one a screen
 * or two down. Folded, the screen can be read top to bottom, and everything
 * is one tap away. The control is the synopsis's "Read more", reused.
 */
function FoldingRows<T>({
  items,
  keyOf,
  render,
  noun,
}: {
  items: readonly T[];
  keyOf: (item: T) => string;
  render: (item: T) => ReactNode;
  /** For the control's accessible name: "Show all 20 nominations". */
  noun: string;
}) {
  const accent = useAccent();
  const [open, setOpen] = useState(false);
  const folds = items.length > FOLD_ABOVE;
  const shown = folds && !open ? items.slice(0, FOLDED_ROWS) : items;

  return (
    <View style={styles.rows}>
      {shown.map((item) => (
        <Fragment key={keyOf(item)}>{render(item)}</Fragment>
      ))}

      {folds && (
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={open ? `Show fewer ${noun}` : `Show all ${items.length} ${noun}`}
          onPress={() => setOpen((value) => !value)}
          scaleTo={0.98}
          style={styles.toggle}>
          <Text variant="h5" style={{ color: accent.onSurface }}>
            {open ? 'Show less' : `Show all ${items.length}`}
          </Text>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={accent.onSurface}
          />
        </PressableScale>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /* A list's interval, not a card's — the Overview widgets' `x12`. */
  rows: { gap: Spacing.x12 },
  /* Two columns that share the row evenly and wrap within themselves. */
  split: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x16 },
  castName: { flex: 1, gap: 1 },
  stacked: { gap: 1 },
  fact: { gap: 2 },
  /* The synopsis toggle's shape: as wide as its label, tall enough to hit. */
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x4,
    minHeight: TapTarget,
  },
});

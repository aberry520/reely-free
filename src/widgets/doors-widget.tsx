import { HStack, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  padding,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetEnvironment } from 'expo-widgets';
import { PlatformColor } from 'react-native';

// Reely Free doors widget (Austin's ask, 2026-11-26): a home screen
// widget that shows each door he has enabled and opens it on tap.
// The app pushes the enabled-doors list as props (see
// src/lib/widgets.ts); the widget itself only renders what it is
// given — it has no hooks, no app state, and no async work, per the
// 'widget' directive rules. Each row is a Link to the door's deep
// link (reelyfree://<route>), which expo-router opens to that door.
//
// The initial props below list ALL five doors. That is deliberate:
// on Austin's phone the snapshot push from the app was not reaching
// the widget (it kept showing the empty state even after opening the
// app several times), so the widget renders the full door list from
// its own defaults until a snapshot arrives. When the app's push
// does land, it narrows the list to just the enabled doors.

export type WidgetDoor = {
  id: string;
  label: string;
  shortLabel: string;
  color: string;
  url: string;
};

type DoorsWidgetProps = {
  doors: WidgetDoor[];
};

const DoorsWidget = (
  props: DoorsWidgetProps,
  environment: WidgetEnvironment,
) => {
  'widget';

  const doors = props.doors ?? [];
  const family = environment.widgetFamily;
  const isSmall = family === 'systemSmall';
  const isLarge = family === 'systemLarge';

  const renderDoor = (door: WidgetDoor, compact: boolean) => (
    <Link key={door.id} destination={door.url}>
      <HStack>
        <Text
          modifiers={[
            font({ size: compact ? 11 : 13 }),
            foregroundStyle(door.color),
          ]}
        >
          ●
        </Text>
        <Text
          modifiers={[
            font({ size: compact ? 12 : isLarge ? 16 : 14 }),
            foregroundStyle(PlatformColor('label')),
          ]}
        >
          {compact ? door.shortLabel : door.label}
        </Text>
        {!compact && (
          <>
            <Spacer />
            <Text
              modifiers={[
                font({ size: 14 }),
                foregroundStyle(PlatformColor('secondaryLabel')),
              ]}
            >
              ›
            </Text>
          </>
        )}
      </HStack>
    </Link>
  );

  // Small (2x2): two columns so all five doors fit. Left column
  // holds the first half, right column the rest.
  if (isSmall) {
    const mid = Math.ceil(doors.length / 2);
    const left = doors.slice(0, mid);
    const right = doors.slice(mid);
    return (
      <VStack
        modifiers={[
          containerBackground(PlatformColor('systemBackground'), 'widget'),
          padding({ all: 10 }),
        ]}
      >
        <Text
          modifiers={[
            font({ weight: 'bold', size: 14 }),
            foregroundStyle(PlatformColor('label')),
          ]}
        >
          Reely Free
        </Text>
        {doors.length === 0 ? (
          <Link destination="reelyfree://">
            <Text
              modifiers={[
                font({ size: 12 }),
                foregroundStyle(PlatformColor('secondaryLabel')),
              ]}
            >
              No doors enabled — open the app to turn one on.
            </Text>
          </Link>
        ) : (
          <HStack>
            <VStack>{left.map((d) => renderDoor(d, true))}</VStack>
            <VStack>{right.map((d) => renderDoor(d, true))}</VStack>
          </HStack>
        )}
      </VStack>
    );
  }

  // Medium and large: one row per door.
  return (
    <VStack
      modifiers={[
        containerBackground(PlatformColor('systemBackground'), 'widget'),
        padding({ all: isLarge ? 16 : 12 }),
      ]}
    >
      <Text
        modifiers={[
          font({ weight: 'bold', size: isLarge ? 17 : 15 }),
          foregroundStyle(PlatformColor('label')),
        ]}
      >
        Reely Free
      </Text>

      {doors.length === 0 ? (
        <Link destination="reelyfree://">
          <Text
            modifiers={[
              font({ size: 13 }),
              foregroundStyle(PlatformColor('secondaryLabel')),
            ]}
          >
            No doors enabled — open the app to turn one on.
          </Text>
        </Link>
      ) : (
        doors.map((door) => renderDoor(door, false))
      )}
    </VStack>
  );
};

export default createWidget<DoorsWidgetProps>('DoorsWidget', DoorsWidget, {
  doors: [
    {
      id: 'facebook',
      label: 'Facebook',
      shortLabel: 'Facebook',
      color: '#1877f2',
      url: 'reelyfree://facebook',
    },
    {
      id: 'instagram',
      label: 'Instagram',
      shortLabel: 'Instagram',
      color: '#c13584',
      url: 'reelyfree://instagram',
    },
    {
      id: 'youtube',
      label: 'YouTube',
      shortLabel: 'YouTube',
      color: '#c4302b',
      url: 'reelyfree://youtube',
    },
    {
      id: 'marketplace',
      label: 'Marketplace — no account',
      shortLabel: 'MP Guest',
      color: '#0f766e',
      url: 'reelyfree://marketplace',
    },
    {
      id: 'marketplaceAccount',
      label: 'Marketplace — with account',
      shortLabel: 'MP Acct',
      color: '#1e40af',
      url: 'reelyfree://marketplace-account',
    },
  ],
});

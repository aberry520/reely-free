import { HStack, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import {
  containerBackground,
  font,
  foregroundStyle,
  frame,
  background,
  padding,
  shapes,
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
//
// Configurable (Austin's ask, 2026-11-27): long-press the widget
// and tap Edit Widget to pick the doors it shows. The app.json
// configuration declares two enum parameters (door1, door2); the
// intent cannot limit them per size, so the limit is enforced here
// by widget family — small shows only door1, medium shows door1 +
// door2, large ignores the picks and shows every enabled door.
// The picks live in WidgetKit (per widget instance) and are never
// overwritten by the snapshot push; a pick for a door that is now
// disabled is filtered out here and falls back to the first enabled
// door(s).

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

// The Edit Widget picks (app.json ios.configuration). Static enums,
// so a value is always present; the defensive ?? guards a render
// before the intent is attached.
type DoorsWidgetConfiguration = {
  door1: string;
  door2: string;
};

const DoorsWidget = (
  props: DoorsWidgetProps,
  environment: WidgetEnvironment<DoorsWidgetConfiguration>,
) => {
  'widget';

  const doors = props.doors ?? [];
  const family = environment.widgetFamily;
  const isSmall = family === 'systemSmall';
  const isLarge = family === 'systemLarge';

  // Which doors to show: intersect the Edit Widget picks with the
  // enabled pool (a pick for a disabled door is dropped), dedupe,
  // then take what the size allows — small 1, medium 2, large all.
  // No usable pick falls back to the first enabled door(s), so the
  // widget always shows something when doors are enabled.
  const config = environment.configuration ?? {};
  const byId = (id: string | undefined) =>
    id ? doors.find((d) => d.id === id) : undefined;
  const picked = [config.door1, config.door2]
    .map((id) => byId(id))
    .filter((d): d is WidgetDoor => !!d);
  const uniquePicked = picked.filter(
    (d, i) => picked.findIndex((x) => x.id === d.id) === i,
  );
  const smallDoors =
    uniquePicked.slice(0, 1).length > 0
      ? uniquePicked.slice(0, 1)
      : doors.slice(0, 1);
  const mediumDoors =
    uniquePicked.slice(0, 2).length > 0
      ? uniquePicked.slice(0, 2)
      : doors.slice(0, 2);
  const shown = isSmall ? smallDoors : isLarge ? doors : mediumDoors;

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

  // Small (2x2): one picked door, styled like a home screen app
  // icon (Austin's ask, 2026-11-27, from his SmartLife screenshot):
  // a dark tile, the door's brand colour as a big rounded icon with
  // its initial in white, and the door name below it in white.
  // No "Reely Free" header — just the door, like the reference.
  // The whole widget is a link to the door.
  if (isSmall) {
    const door = shown[0];
    return (
      <VStack
        modifiers={[
          containerBackground('#1c1c1e', 'widget'),
          padding({ all: 12 }),
        ]}
      >
        {shown.length === 0 || !door ? (
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
          <Link destination={door.url}>
            <VStack>
              <Spacer />
              <Text
                modifiers={[
                  font({ size: 36, weight: 'bold' }),
                  foregroundStyle('#ffffff'),
                  frame({ width: 76, height: 76 }),
                  background(
                    door.color,
                    shapes.roundedRectangle({ cornerRadius: 18 }),
                  ),
                ]}
              >
                {door.label.charAt(0)}
              </Text>
              <Text
                modifiers={[
                  font({ size: 15, weight: 'bold' }),
                  foregroundStyle('#ffffff'),
                  padding({ top: 10 }),
                ]}
              >
                {door.label}
              </Text>
              <Spacer />
            </VStack>
          </Link>
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

      {shown.length === 0 ? (
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
        shown.map((door) => renderDoor(door, false))
      )}
    </VStack>
  );
};

export default createWidget<
  DoorsWidgetProps,
  DoorsWidgetConfiguration
>('DoorsWidget', DoorsWidget, {
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

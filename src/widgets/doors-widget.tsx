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

export type WidgetDoor = {
  id: string;
  label: string;
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
  const isLarge = environment.widgetFamily === 'systemLarge';

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
        doors.map((door) => (
          <Link key={door.id} destination={door.url}>
            <HStack>
              <Text
                modifiers={[
                  font({ size: 13 }),
                  foregroundStyle(door.color),
                ]}
              >
                ●
              </Text>
              <Text
                modifiers={[
                  font({ size: isLarge ? 16 : 14 }),
                  foregroundStyle(PlatformColor('label')),
                ]}
              >
                {door.label}
              </Text>
              <Spacer />
              <Text
                modifiers={[
                  font({ size: 14 }),
                  foregroundStyle(PlatformColor('secondaryLabel')),
                ]}
              >
                ›
              </Text>
            </HStack>
          </Link>
        ))
      )}
    </VStack>
  );
};

export default createWidget<DoorsWidgetProps>('DoorsWidget', DoorsWidget, {
  doors: [],
});

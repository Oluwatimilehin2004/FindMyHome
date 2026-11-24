import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, T, type IconName } from '@/components/ui';
import { markOnboardingSeen } from '@/lib/onboarding';
import { colors, radius, shadow, space } from '@/theme';

// FR 6.2 — first-time introduction.
const SLIDES: { icon: IconName; overline: string; title: string; body: string }[] = [
  {
    icon: 'business-outline',
    overline: 'Verified housing information',
    title: 'Know the property\nbefore you pay',
    body: 'Read what previous tenants experienced at a property in Kigali before paying an agent, a viewing fee or a deposit.',
  },
  {
    icon: 'search-outline',
    overline: 'Search',
    title: 'Find any listed\nproperty',
    body: 'Search by property name, street address or neighbourhood, such as Kagugu or Gacuriro.',
  },
  {
    icon: 'shield-checkmark-outline',
    overline: 'Verification',
    title: 'Every review is\nchecked',
    body: 'Reviews cover listing accuracy, the security deposit, landlord conduct and the neighbourhood. Each one is verified against evidence of tenancy before publication.',
  },
  {
    icon: 'eye-off-outline',
    overline: 'Anonymity',
    title: 'Reviewers remain\nanonymous',
    body: 'Your name is never published or shared with landlords. Only the year of your tenancy is shown.',
  },
];

/** Block grid illustration, filled progressively per slide (reference: performance widget). */
function Blocks({ step }: { step: number }) {
  const cols = 8;
  const rows = 5;
  return (
    <View style={{ flexDirection: 'row', gap: 5 }}>
      {Array.from({ length: cols }).map((_, c) => {
        const h = Math.min(rows, Math.round(((c + 1) / cols) * (step + 2)));
        return (
          <View key={c} style={{ gap: 5 }}>
            {Array.from({ length: rows }).map((__, r) => {
              const filled = rows - r <= h;
              return (
                <View
                  key={r}
                  style={{
                    width: 16,
                    height: 16,
                    borderRadius: 4,
                    backgroundColor: filled ? colors.primary : colors.field,
                    borderWidth: filled ? 0 : 1,
                    borderColor: colors.border,
                  }}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}

export default function Onboarding() {
  const insets = useSafeAreaInsets();
  const [i, setI] = useState(0);
  const slide = SLIDES[i];
  const last = i === SLIDES.length - 1;

  async function finish() {
    await markOnboardingSeen();
    router.replace('/');
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.xl }}>
        <T weight="semibold" size={15}>
          FindMyHome
        </T>
        {!last ? (
          <Pressable onPress={finish} hitSlop={10} accessibilityRole="button">
            <T size={13} weight="medium" color={colors.muted}>
              Skip
            </T>
          </Pressable>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: space.lg, marginTop: space.xl }}>
        <View
          style={[
            {
              height: 300,
              backgroundColor: colors.card,
              borderRadius: radius.xl,
              borderWidth: 1,
              borderColor: colors.hairline,
              alignItems: 'center',
              justifyContent: 'center',
              gap: space.xl,
            },
            shadow,
          ]}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: colors.raised,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name={slide.icon} size={28} color={colors.text} />
          </View>
          <Blocks step={i} />
          <View
            style={{
              position: 'absolute',
              top: space.lg,
              right: space.lg,
              backgroundColor: colors.field,
              borderRadius: radius.pill,
              paddingHorizontal: 10,
              paddingVertical: 3,
            }}
          >
            <T size={12} weight="medium" color={colors.muted}>
              {String(i + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
            </T>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: space.lg }}>
        {SLIDES.map((_, idx) => (
          <View
            key={idx}
            style={{
              width: idx === i ? 24 : 8,
              height: 4,
              borderRadius: 2,
              backgroundColor: idx === i ? colors.primary : colors.hatch,
            }}
          />
        ))}
      </View>

      <View style={{ flex: 1, padding: space.xl, justifyContent: 'space-between', paddingBottom: insets.bottom + space.xl }}>
        <View style={{ gap: space.sm }}>
          <T size={11} weight="medium" color={colors.muted} style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
            {slide.overline}
          </T>
          <T weight="semibold" size={28} style={{ lineHeight: 36, letterSpacing: -0.6 }}>
            {slide.title}
          </T>
          <T size={14} color={colors.muted} style={{ lineHeight: 21 }}>
            {slide.body}
          </T>
        </View>
        <View style={{ flexDirection: 'row', gap: space.md }}>
          {i > 0 ? (
            <View style={{ width: 56 }}>
              <Button title="" icon="arrow-back" variant="secondary" onPress={() => setI(i - 1)} />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button title={last ? 'Get started' : 'Continue'} onPress={last ? finish : () => setI(i + 1)} />
          </View>
        </View>
      </View>
    </View>
  );
}

import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, radius, shadow, space, TAB_BAR_CLEARANCE } from '@/theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];

// ------------------------------------------------------------------ Layout

/**
 * Standard page. `tabScreen` leaves room for the floating tab bar;
 * `header` is rendered above the scroll area so it stays fixed.
 */
export function Screen({
  children,
  scroll = true,
  header,
  footer,
  tabScreen,
  edges = ['bottom', 'left', 'right'],
}: {
  children: ReactNode;
  scroll?: boolean;
  header?: ReactNode;
  footer?: ReactNode;
  tabScreen?: boolean;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const bottom = tabScreen ? TAB_BAR_CLEARANCE : space.xxl;
  return (
    <SafeAreaView style={styles.safe} edges={edges}>
      {header}
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: bottom }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}

/** Centred title with round back button (reference: "Schedule" screen). */
export function TopBar({ title, right, onBack }: { title: string; right?: ReactNode; onBack?: () => void }) {
  const back = onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')));
  return (
    <View style={styles.topBar}>
      <IconButton icon="arrow-back" onPress={back} label="Back" />
      <T weight="semibold" size={17} numberOfLines={1} style={{ flex: 1, textAlign: 'center' }}>
        {title}
      </T>
      {right ?? <View style={{ width: 40 }} />}
    </View>
  );
}

/** Large left-aligned page title with optional actions (reference: "Welcome, Salung"). */
export function PageTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <View style={{ flex: 1, gap: 2 }}>
        <T weight="semibold" size={24} style={{ letterSpacing: -0.4 }}>
          {title}
        </T>
        {subtitle ? (
          <T size={13} color={colors.muted}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right ? <View style={{ flexDirection: 'row', gap: space.sm }}>{right}</View> : null}
    </View>
  );
}

/** Section heading with optional trailing action ("Today's tasks … See all"). */
export function SectionTitle({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs }}>
      <T weight="semibold" size={16}>
        {title}
      </T>
      {action && onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityRole="button">
          <T size={13} weight="medium">
            {action}
          </T>
        </Pressable>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------------ Type

export function T({
  children,
  style,
  weight = 'regular',
  size = 14,
  color = colors.text,
  numberOfLines,
  onPress,
}: {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  weight?: keyof typeof fonts;
  size?: number;
  color?: string;
  numberOfLines?: number;
  onPress?: () => void;
}) {
  return (
    <Text
      onPress={onPress}
      numberOfLines={numberOfLines}
      style={[{ fontFamily: fonts[weight], fontSize: size, color, lineHeight: Math.round(size * 1.45) }, style]}
    >
      {children}
    </Text>
  );
}

export function H1({ children }: { children: ReactNode }) {
  return (
    <T weight="semibold" size={24} style={{ letterSpacing: -0.4 }}>
      {children}
    </T>
  );
}

export function H2({ children }: { children: ReactNode }) {
  return (
    <T weight="semibold" size={15}>
      {children}
    </T>
  );
}

export function Body({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return <T color={muted ? colors.muted : colors.text}>{children}</T>;
}

/** Small uppercase label used to head groups of fields and record sections. */
export function Overline({ children }: { children: ReactNode }) {
  return (
    <T size={11} weight="medium" color={colors.muted} style={{ letterSpacing: 0.8, textTransform: 'uppercase' }}>
      {children}
    </T>
  );
}

// ------------------------------------------------------------------ Surfaces

/** Surface card. `accent` adds the dark left bar used for records (reference: task cards). */
export function Card({
  children,
  style,
  accent,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  accent?: boolean | string;
}) {
  if (accent) {
    const bar = typeof accent === 'string' ? accent : colors.primary;
    return (
      <View style={[styles.card, { flexDirection: 'row', gap: space.md }, style]}>
        <View style={{ width: 3, borderRadius: 2, backgroundColor: bar }} />
        <View style={{ flex: 1, gap: space.sm }}>{children}</View>
      </View>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border }, style]} />;
}

/** Label on the left, value on the right; used for record details. */
export function KeyValue({ label, value, children }: { label: string; value?: string; children?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.md, paddingVertical: 6 }}>
      <T size={13} color={colors.muted}>
        {label}
      </T>
      {children ?? (
        <T size={13} weight="medium" style={{ flexShrink: 1, textAlign: 'right' }}>
          {value ?? '—'}
        </T>
      )}
    </View>
  );
}

// ------------------------------------------------------------------ Controls

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  compact,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  compact?: boolean;
}) {
  const bg = { primary: colors.primary, danger: colors.card, secondary: colors.card, ghost: 'transparent' }[variant];
  const fg = { primary: colors.primaryText, danger: colors.danger, secondary: colors.text, ghost: colors.text }[variant];
  const border = { primary: colors.primary, danger: colors.danger, secondary: colors.border, ghost: 'transparent' }[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        compact && { minHeight: 40, paddingHorizontal: space.lg },
        { backgroundColor: bg, borderColor: border, opacity: isDisabled ? 0.4 : pressed ? 0.82 : 1 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          {icon ? <Ionicons name={icon} size={compact ? 15 : 17} color={fg} /> : null}
          <T weight="medium" size={compact ? 13 : 15} color={fg}>
            {title}
          </T>
        </View>
      )}
    </Pressable>
  );
}

/** Round outlined icon button (reference: bell / calendar / back). */
export function IconButton({
  icon,
  onPress,
  label,
  dark,
  size = 40,
}: {
  icon: IconName;
  onPress: () => void;
  label: string;
  dark?: boolean;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={6}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: size / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: dark ? colors.primary : colors.card,
        borderWidth: dark ? 0 : 1,
        borderColor: colors.border,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Ionicons name={icon} size={Math.round(size * 0.45)} color={dark ? colors.primaryText : colors.text} />
    </Pressable>
  );
}

export function Field({
  label,
  hint,
  optional,
  ...props
}: TextInputProps & { label: string; hint?: string; optional?: boolean }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'baseline' }}>
        <T weight="medium" size={13}>
          {label}
        </T>
        {optional ? (
          <T size={12} color={colors.faint}>
            Optional
          </T>
        ) : null}
      </View>
      {hint ? (
        <T size={12} color={colors.muted}>
          {hint}
        </T>
      ) : null}
      <TextInput
        placeholderTextColor={colors.faint}
        {...props}
        style={[styles.input, props.multiline && { minHeight: 92, textAlignVertical: 'top', paddingTop: 12 }, props.style]}
      />
    </View>
  );
}

/** Rounded search field with an optional trailing icon action (reference: search + filter). */
export function SearchBar({
  value,
  onChangeText,
  onSubmit,
  placeholder,
  actionIcon = 'options-outline',
  onAction,
  actionLabel = 'Search options',
}: {
  value: string;
  onChangeText: (t: string) => void;
  onSubmit?: () => void;
  placeholder: string;
  actionIcon?: IconName;
  onAction?: () => void;
  actionLabel?: string;
}) {
  return (
    <View style={styles.search}>
      <Ionicons name="search-outline" size={17} color={colors.muted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        returnKeyType="search"
        autoCorrect={false}
        style={{ flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text, paddingVertical: 12 }}
      />
      {value ? (
        <Pressable onPress={() => onChangeText('')} hitSlop={8} accessibilityLabel="Clear search">
          <Ionicons name="close-circle" size={17} color={colors.faint} />
        </Pressable>
      ) : onAction ? (
        <Pressable onPress={onAction} hitSlop={8} accessibilityLabel={actionLabel}>
          <Ionicons name={actionIcon} size={18} color={colors.muted} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** Pill segmented control; the selected option sits on a raised white chip (reference: date picker). */
export function SegmentTabs<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <View style={styles.segment}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segmentItem, active && styles.segmentActive]}
          >
            <T size={13} weight={active ? 'medium' : 'regular'} color={active ? colors.text : colors.muted}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Single-choice list with radio indicators. Formal alternative to chips. */
export function RadioGroup<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string; description?: string }[];
  value: V | null;
  onChange: (v: V) => void;
}) {
  return (
    <View style={styles.listBox}>
      {options.map((o, i) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              styles.listRow,
              i > 0 && styles.listRowBorder,
              pressed && { backgroundColor: colors.field },
            ]}
          >
            <View style={[styles.radio, selected && { borderColor: colors.primary }]}>
              {selected ? <View style={styles.radioDot} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <T size={14} weight={selected ? 'medium' : 'regular'}>
                {o.label}
              </T>
              {o.description ? (
                <T size={12} color={colors.muted}>
                  {o.description}
                </T>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Multiple-choice list with square check indicators. */
export function CheckGroup<V extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: V; label: string }[];
  value: V[];
  onChange: (v: V[]) => void;
}) {
  return (
    <View style={styles.listBox}>
      {options.map((o, i) => {
        const checked = value.includes(o.value);
        return (
          <Pressable
            key={o.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked }}
            onPress={() => onChange(checked ? value.filter((x) => x !== o.value) : [...value, o.value])}
            style={({ pressed }) => [
              styles.listRow,
              i > 0 && styles.listRowBorder,
              pressed && { backgroundColor: colors.field },
            ]}
          >
            <View style={[styles.checkbox, checked && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
              {checked ? <Ionicons name="checkmark" size={13} color={colors.primaryText} /> : null}
            </View>
            <T size={14} style={{ flex: 1 }}>
              {o.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Compact inline segmented answer (e.g. Yes / No / Not applicable) for statement questions. */
export function AnswerRow<V extends string>({
  question,
  options,
  value,
  onChange,
}: {
  question: string;
  options: { value: V; label: string }[];
  value: V | null;
  onChange: (v: V) => void;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <T size={14}>{question}</T>
      <View style={styles.segment}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              style={[styles.segmentItem, active && { backgroundColor: colors.primary }]}
            >
              <T size={13} weight="medium" color={active ? colors.primaryText : colors.muted}>
                {o.label}
              </T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ------------------------------------------------------------------ Feedback

/** Inline error shown on the same screen as the problem (NFR 5). */
export function ErrorText({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return (
    <View style={[styles.banner, { backgroundColor: colors.dangerSoft }]} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={17} color={colors.danger} />
      <T size={13} color={colors.danger} style={{ flex: 1 }}>
        {message}
      </T>
    </View>
  );
}

export function Notice({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' | 'ok' }) {
  const [bg, fg, icon] = {
    info: [colors.infoSoft, colors.info, 'information-circle-outline'],
    warn: [colors.warnSoft, colors.warn, 'time-outline'],
    ok: [colors.okSoft, colors.ok, 'checkmark-circle-outline'],
  }[tone] as [string, string, IconName];
  return (
    <View style={[styles.banner, { backgroundColor: bg }]}>
      <Ionicons name={icon} size={17} color={fg} />
      <T size={13} color={fg} style={{ flex: 1 }}>
        {children}
      </T>
    </View>
  );
}

export type Tone = 'ok' | 'warn' | 'danger' | 'neutral' | 'info' | 'dark';

const TONES: Record<Tone, [string, string]> = {
  ok: [colors.okSoft, colors.ok],
  warn: [colors.warnSoft, colors.warn],
  danger: [colors.dangerSoft, colors.danger],
  neutral: [colors.field, colors.muted],
  info: [colors.infoSoft, colors.info],
  dark: [colors.primary, colors.primaryText],
};

/** Small status pill with a leading dot or icon. */
export function Badge({ label, tone, icon }: { label: string; tone: Tone; icon?: IconName }) {
  const [bg, fg] = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? (
        <Ionicons name={icon} size={12} color={fg} />
      ) : (
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: fg }} />
      )}
      <T size={12} weight="medium" color={fg}>
        {label}
      </T>
    </View>
  );
}

/** Small icon + text pair. */
export function Stat({ icon, label }: { icon: IconName; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Ionicons name={icon} size={14} color={colors.muted} />
      <T size={12} color={colors.muted}>
        {label}
      </T>
    </View>
  );
}

/**
 * Block meter (reference: performance grid). One block per response, up to 10;
 * filled blocks are the positive answers. Larger counts are scaled to 10 blocks.
 */
export function BlockMeter({ yes, total, blocks = 10 }: { yes: number; total: number; blocks?: number }) {
  const n = total <= blocks ? Math.max(total, 1) : blocks;
  const filled = total === 0 ? 0 : total <= blocks ? yes : Math.round((yes / total) * blocks);
  return (
    <View style={{ flexDirection: 'row', gap: 3 }} accessibilityLabel={`${yes} of ${total}`}>
      {Array.from({ length: n }).map((_, i) => (
        <View
          key={i}
          style={{
            width: 10,
            height: 14,
            borderRadius: 2,
            backgroundColor: i < filled ? colors.primary : colors.field,
            borderWidth: i < filled ? 0 : 1,
            borderColor: colors.border,
          }}
        />
      ))}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ padding: space.xl, alignItems: 'center' }}>
      <ActivityIndicator color={colors.text} />
    </View>
  );
}

export function EmptyState({ title, body, icon = 'home-outline' }: { title: string; body?: string; icon?: IconName }) {
  return (
    <View style={{ paddingVertical: space.xl, paddingHorizontal: space.lg, alignItems: 'center', gap: space.sm }}>
      <View style={[styles.iconTile, { width: 52, height: 52, borderRadius: 26 }]}>
        <Ionicons name={icon} size={22} color={colors.muted} />
      </View>
      <T weight="semibold" size={15} style={{ textAlign: 'center' }}>
        {title}
      </T>
      {body ? (
        <T color={colors.muted} size={13} style={{ textAlign: 'center' }}>
          {body}
        </T>
      ) : null}
    </View>
  );
}

export const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.lg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  label: { fontFamily: fonts.medium, fontSize: 13, color: colors.text },
  hint: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, color: colors.muted },
  h2: { fontFamily: fonts.semibold, fontSize: 15, color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.hairline,
    ...shadow,
  },
  button: {
    minHeight: 50,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  input: {
    backgroundColor: colors.raised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: fonts.regular,
    color: colors.text,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: colors.card,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: space.lg,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: colors.field,
    borderRadius: radius.pill,
    padding: 3,
    gap: 2,
  },
  segmentItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  segmentActive: { backgroundColor: colors.raised, ...shadow },
  listBox: {
    backgroundColor: colors.raised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: 12 },
  listRowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  radio: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: colors.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  banner: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start', borderRadius: radius.md, padding: space.md },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.field,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

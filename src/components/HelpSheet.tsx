import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, space } from '@/theme';

import { Button, Divider, IconButton, T } from './ui';

// FR 6.1 — help and frequently asked questions, available from every main screen.
const FAQ: { q: string; a: string }[] = [
  {
    q: 'What does “verified” mean?',
    a: 'Every published review comes from a person who provided evidence of tenancy, such as a signed tenancy agreement, a written landlord confirmation or a rent receipt. The FindMyHome team examines that evidence before a review is published.',
  },
  {
    q: 'Who writes the reviews?',
    a: 'Current and former student tenants. A number of early reviews were collected in person by the FindMyHome team; these are labelled “Verified by FindMyHome”.',
  },
  {
    q: 'How do I submit a review?',
    a: 'Select the + button at the bottom of the screen, choose the property, complete each section of the assessment and attach your evidence of tenancy. An account is required.',
  },
  {
    q: 'How long does verification take?',
    a: 'Our target is 48 hours. You will receive a notification when a decision is made, and the status of each submission is shown under My reviews. If a review cannot be approved, the reason is stated there.',
  },
  {
    q: 'Will the landlord know I wrote a review?',
    a: 'No. Your name is never published. Reviews show only the year of your tenancy, and your evidence document is visible to the FindMyHome team alone.',
  },
  {
    q: 'Can FindMyHome assist with a dispute?',
    a: 'No. FindMyHome publishes verified information only. We are unable to mediate or act on your behalf in a dispute with a landlord.',
  },
  {
    q: 'The property I lived in is not listed.',
    a: 'You may add it while submitting your review. It will appear in search results once your review has been verified.',
  },
  {
    q: 'How do I contact a landlord?',
    a: 'Where the landlord’s number is on file, open the property and select “Show contact details” at the end of the reviews. You must be signed in. You then call or message the landlord directly; FindMyHome is not a party to any arrangement. Never pay a deposit before viewing a property.',
  },
  {
    q: 'What happens to my evidence document?',
    a: 'It is seen only by the FindMyHome team. If your review is declined, the document is deleted.',
  },
];

/** Round "?" button that opens the help sheet. Place it in any screen header. */
export function HelpButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <IconButton icon="help" label="Help and FAQs" onPress={() => setOpen(true)} />
      <HelpSheet visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, justifyContent: 'flex-end' }}>
        <Pressable
          style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(20,19,17,0.35)' }}
          onPress={onClose}
          accessibilityLabel="Close help"
        />
        <View
          style={{
            maxHeight: '85%',
            backgroundColor: colors.card,
            borderTopLeftRadius: radius.xl,
            borderTopRightRadius: radius.xl,
            paddingTop: space.sm,
            paddingBottom: insets.bottom + space.lg,
          }}
        >
          <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border }} />
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: space.xl,
              paddingTop: space.lg,
              paddingBottom: space.md,
            }}
          >
            <View style={{ flex: 1 }}>
              <T weight="semibold" size={18}>
                Help and FAQs
              </T>
              <T size={13} color={colors.muted}>
                How FindMyHome verifies and publishes reviews
              </T>
            </View>
            <IconButton icon="close" label="Close" onPress={onClose} size={36} />
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: space.lg }}>
            {FAQ.map((item, i) => {
              const isOpen = expanded === i;
              return (
                <View key={item.q}>
                  {i > 0 ? <Divider /> : null}
                  <Pressable
                    onPress={() => setExpanded(isOpen ? null : i)}
                    accessibilityRole="button"
                    accessibilityState={{ expanded: isOpen }}
                    style={{ paddingVertical: space.md, gap: space.sm }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                      <T weight="medium" style={{ flex: 1 }}>
                        {item.q}
                      </T>
                      <Ionicons name={isOpen ? 'remove' : 'add'} size={18} color={colors.muted} />
                    </View>
                    {isOpen ? (
                      <T size={13} color={colors.muted} style={{ lineHeight: 20 }}>
                        {item.a}
                      </T>
                    ) : null}
                  </Pressable>
                </View>
              );
            })}
            <View style={{ marginTop: space.lg }}>
              <Button
                title="View the introduction again"
                variant="secondary"
                icon="play-circle-outline"
                onPress={() => {
                  onClose();
                  router.push('/onboarding');
                }}
              />
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

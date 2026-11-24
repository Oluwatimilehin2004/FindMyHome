import { Redirect, router } from 'expo-router';

import { emptyProperty, PropertyForm } from '@/components/PropertyForm';
import { Screen, TopBar } from '@/components/ui';
import { adminCreateProperty, adminSetPropertyPhoto, friendlyError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

// Use case "Add/edit property" (admin) — add.
export default function AddProperty() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Redirect href="/" />;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} header={<TopBar title="Add property" />}>
      <PropertyForm
        initial={emptyProperty}
        submitLabel="Save property"
        onSave={async (values, photo) => {
          let id: string;
          try {
            id = await adminCreateProperty(values);
          } catch (e) {
            throw new Error(friendlyError(e));
          }
          if (photo) {
            try {
              await adminSetPropertyPhoto(id, photo);
            } catch {
              // The property is saved; the photo can be added later from the property page.
            }
          }
          router.replace({ pathname: '/property/[id]', params: { id } });
        }}
      />
    </Screen>
  );
}

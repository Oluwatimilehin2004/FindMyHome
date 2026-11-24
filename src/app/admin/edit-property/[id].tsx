import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { PropertyForm, type PropertyFormValues } from '@/components/PropertyForm';
import { Button, ErrorText, Loading, Screen, TopBar } from '@/components/ui';
import { adminGetProperty, adminSetPropertyPhoto, adminUpdateProperty, friendlyError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

// Use case "Add/edit property" (admin) — edit.
export default function EditProperty() {
  const { isAdmin } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [initial, setInitial] = useState<PropertyFormValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await adminGetProperty(id);
      if (!p) setError('This property could not be found.');
      else setInitial(p);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (isAdmin) void load();
  }, [isAdmin, load]);

  if (!isAdmin) return <Redirect href="/" />;

  return (
    <Screen edges={['top', 'left', 'right', 'bottom']} header={<TopBar title="Edit property" />}>
      {loading ? <Loading /> : null}
      {!loading && error ? (
        <>
          <ErrorText message={error} />
          <Button title="Try again" variant="secondary" onPress={load} />
        </>
      ) : null}
      {initial ? (
        <PropertyForm
          initial={initial}
          submitLabel="Save changes"
          showListing
          onSave={async (values, photo) => {
            try {
              await adminUpdateProperty(id, values);
            } catch (e) {
              throw new Error(friendlyError(e));
            }
            if (photo) {
              try {
                await adminSetPropertyPhoto(id, photo);
              } catch (e) {
                throw new Error(`Details saved, but the photo could not be uploaded. ${friendlyError(e)}`);
              }
            }
            // Back to the property page, which reloads; a hidden property is no longer viewable there.
            if (values.isPublished) router.back();
            else router.dismissAll();
          }}
        />
      ) : null}
    </Screen>
  );
}

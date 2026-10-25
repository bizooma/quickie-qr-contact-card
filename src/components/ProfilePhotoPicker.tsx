import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PhotoEditor } from "@/components/PhotoEditor";
import { ProfileAvatar } from "@/components/ProfileMenu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { listCards } from "@/lib/cards-api";
import { removeMedia, signedUrls, uploadAvatar } from "@/lib/media";
import { AVATAR_NONE, avatarSource, isUploadedAvatar } from "@/lib/profile-avatar";
import { cn } from "@/lib/utils";

/** Settings → Profile: pick the photo in the avatar menu. Upload one, reuse a
 *  card photo or the sign-in provider's photo, or show initials. */
export function ProfilePhotoPicker() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (await supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle()).data,
  });
  const { data: cards } = useQuery({ queryKey: ["cards"], queryFn: listCards, enabled: !!user });
  const withPhoto = (cards ?? []).filter((c) => c.user_id === user?.id && c.headshot_path);
  const paths = withPhoto.map((c) => c.headshot_path as string);
  const { data: urls = {} } = useQuery({
    queryKey: ["card-headshots", paths],
    enabled: paths.length > 0,
    staleTime: 30 * 60 * 1000,
    queryFn: () => signedUrls(paths),
  });
  const current = avatarSource(profile?.avatar_url, paths);
  const meta = user?.user_metadata as { avatar_url?: unknown; picture?: unknown } | undefined;
  const providerPhoto = [meta?.avatar_url, meta?.picture].find(
    (v): v is string => typeof v === "string" && /^https:\/\//i.test(v),
  );

  async function choose(next: string, done: string) {
    if (!user) return;
    const prev = profile?.avatar_url ?? null;
    const { error } = await supabase
      .from("profiles")
      .update({ avatar_url: next })
      .eq("id", user.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    // Only our own uploads are deleted; a card photo stays with its card.
    if (isUploadedAvatar(prev) && prev !== next) void removeMedia([prev]).catch(() => {});
    await qc.invalidateQueries({ queryKey: ["profile", user.id] });
    toast.success(done);
  }

  return (
    <div className="space-y-2">
      <Label>Profile photo</Label>
      <div className="flex items-center gap-4">
        <ProfileAvatar className="h-16 w-16" />
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            Upload photo
          </Button>
          {providerPhoto && !(current.kind === "url" && current.url === providerPhoto) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void choose(providerPhoto, "Using your Google photo")}
            >
              Use my Google photo
            </Button>
          )}
          {current.kind !== "none" && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => void choose(AVATAR_NONE, "Showing your initials")}
            >
              Remove
            </Button>
          )}
        </div>
      </div>
      {withPhoto.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground">Or use the photo from one of your cards:</p>
          <div className="flex flex-wrap gap-2">
            {withPhoto.map((c) => {
              const path = c.headshot_path as string;
              const selected = current.kind === "path" && current.path === path;
              return (
                <button
                  key={c.id}
                  type="button"
                  aria-label={`Use the photo from your ${c.label} card`}
                  aria-pressed={selected}
                  onClick={() => void choose(path, `Using the photo from your ${c.label} card`)}
                  className={cn(
                    "h-11 w-11 overflow-hidden rounded-full bg-muted ring-2 ring-offset-2 ring-offset-background transition",
                    selected ? "ring-brand" : "ring-transparent hover:ring-border",
                  )}
                >
                  {urls[path] && (
                    <img src={urls[path]} alt="" className="h-full w-full object-cover" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <PhotoEditor
        open={editing}
        onOpenChange={setEditing}
        title="Profile photo"
        sourceUrl={null}
        shape="circle"
        output="image/jpeg"
        onSave={async (blob) => {
          if (!user) return;
          const path = await uploadAvatar(user.id, blob);
          await choose(path, "Profile photo updated");
        }}
      />
    </div>
  );
}

import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import {
  isMemberRole,
  isMemberStatus,
  type MemberRole,
  type MemberStatus,
} from "@/lib/permissions";
import { createServiceClient } from "@/lib/supabase/service";

export type AppSupabaseClient = SupabaseClient<Database>;

export interface CurrentIdentity {
  userId: string;
  email: string | null;
  name: string | null;
}

export interface CurrentMemberProfile {
  id: string;
  tenant_id: string;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  notify_lead_days: number[];
  notify_channels: string[];
  notify_match: boolean;
  daily_summary_at: string | null;
  role: MemberRole;
  permissions: string[];
  status: MemberStatus;
  invited_at: string | null;
  accepted_at: string | null;
  disabled_at: string | null;
}

type ClaimsPayload = {
  sub?: string;
  email?: string;
  user_metadata?: {
    name?: unknown;
    full_name?: unknown;
  };
};

function metadataName(metadata: Record<string, unknown> | null | undefined) {
  const name = metadata?.name ?? metadata?.full_name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function normalizeProfile(
  profile: Database["public"]["Tables"]["profile"]["Row"] | null,
): CurrentMemberProfile | null {
  if (!profile || !isMemberRole(profile.role) || !isMemberStatus(profile.status)) {
    return null;
  }

  return {
    ...profile,
    role: profile.role,
    permissions: profile.permissions ?? [],
    status: profile.status,
  };
}

async function getCurrentIdentityImpl(
  supabase: AppSupabaseClient,
): Promise<CurrentIdentity | null> {
  const [authRes, claimsRes] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getClaims(),
  ]);
  const user = authRes.data.user;
  const claims = claimsRes.data?.claims as ClaimsPayload | undefined;
  const userId = user?.id ?? claims?.sub ?? null;

  if (!userId) return null;

  return {
    userId,
    email: user?.email ?? claims?.email ?? null,
    name:
      metadataName(user?.user_metadata) ??
      metadataName(claims?.user_metadata) ??
      null,
  };
}

async function readCurrentMemberProfileImpl(
  supabase: AppSupabaseClient,
  userId: string,
): Promise<CurrentMemberProfile | null> {
  const userProfile = await supabase
    .from("profile")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const normalized = normalizeProfile(userProfile.data);
  if (normalized) return normalized;

  if (userProfile.error) {
    console.error(
      "[readCurrentMemberProfile:user]",
      userProfile.error.code,
      userProfile.error.message,
    );
  }

  const service = createServiceClient();
  if (!service) return null;

  const serviceProfile = await service
    .from("profile")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (serviceProfile.error) {
    console.error(
      "[readCurrentMemberProfile:service]",
      serviceProfile.error.code,
      serviceProfile.error.message,
    );
  }

  return normalizeProfile(serviceProfile.data);
}

export const getCurrentIdentity = cache(getCurrentIdentityImpl);
export const readCurrentMemberProfile = cache(readCurrentMemberProfileImpl);

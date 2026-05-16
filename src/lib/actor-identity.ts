import { getActingCompanyId, getCompanyFromStorage } from "./company-acting";
import type { ActorProfileType, Company, User } from "./types";

type MinimalUser = Pick<
  User,
  "id" | "full_name" | "username" | "profile"
>;

export type ActorIdentity = {
  profileType: ActorProfileType;
  companyId: number | null;
  name: string;
  username: string;
  avatar: string | null;
};

export function buildActorIdentity(user: MinimalUser, companyOverride?: Company | null): ActorIdentity {
  const actingCompanyId = getActingCompanyId();
  const company = companyOverride ?? getCompanyFromStorage();

  if (actingCompanyId && company?.id === actingCompanyId) {
    return {
      profileType: "company",
      companyId: actingCompanyId,
      name: company.name || user.full_name || "Entreprise ITGA",
      username: `company-${actingCompanyId}`,
      avatar: company.logo ?? null,
    };
  }

  return {
    profileType: "user",
    companyId: null,
    name: user.full_name || user.username || "Utilisateur ITGA",
    username: user.username || `user-${user.id}`,
    avatar: user.profile ?? null,
  };
}

export function actorName(actor: ActorIdentity | null | undefined, fallback = "Utilisateur ITGA"): string {
  return actor?.name || fallback;
}

export function actorAvatar(actor: ActorIdentity | null | undefined): string | null {
  return actor?.avatar ?? null;
}

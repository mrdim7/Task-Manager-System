import { Client } from "ldapts";

export interface LdapConfig {
  url: string;
  baseDn: string;
  bindDn: string;
  bindPassword: string;
  userFilter: string;
  attrEmail: string;
  attrFirstName: string;
  attrSurname: string;
}

export interface LdapUser {
  dn: string;
  email: string;
  firstName: string;
  surname: string;
}

export function getLdapConfig(): LdapConfig | null {
  const url = process.env["LDAP_URL"];
  if (!url) return null;

  return {
    url,
    baseDn: process.env["LDAP_BASE_DN"] ?? "",
    bindDn: process.env["LDAP_BIND_DN"] ?? "",
    bindPassword: process.env["LDAP_BIND_PASSWORD"] ?? "",
    userFilter: process.env["LDAP_USER_FILTER"] ?? "(&(objectClass=person)(mail={{email}}))",
    attrEmail: process.env["LDAP_ATTR_EMAIL"] ?? "mail",
    attrFirstName: process.env["LDAP_ATTR_FIRSTNAME"] ?? "givenName",
    attrSurname: process.env["LDAP_ATTR_SURNAME"] ?? "sn",
  };
}

function escapeLdapFilter(value: string): string {
  return value
    .replace(/\\/g, "\\5c")
    .replace(/\*/g, "\\2a")
    .replace(/\(/g, "\\28")
    .replace(/\)/g, "\\29")
    .replace(/\0/g, "\\00");
}

function getAttrValue(entry: Record<string, string | string[]>, attr: string): string {
  const val = entry[attr];
  if (Array.isArray(val)) return val[0] ?? "";
  return val ?? "";
}

/**
 * Look up a user in LDAP by email and verify their password.
 * Returns the user's attributes if authentication succeeds, or null if it fails.
 */
export async function authenticateLdapUser(
  email: string,
  password: string,
  config: LdapConfig,
): Promise<LdapUser | null> {
  const client = new Client({
    url: config.url,
    connectTimeout: 5000,
    tlsOptions: { rejectUnauthorized: false },
  });

  try {
    await client.bind(config.bindDn, config.bindPassword);

    const filter = config.userFilter.replace("{{email}}", escapeLdapFilter(email));
    const { searchEntries } = await client.search(config.baseDn, {
      scope: "sub",
      filter,
      attributes: ["dn", config.attrEmail, config.attrFirstName, config.attrSurname],
    });

    if (!searchEntries.length) {
      return null;
    }

    const entry = searchEntries[0] as Record<string, string | string[]>;
    const userDn = entry["dn"] as string;

    await client.unbind();

    const userClient = new Client({
      url: config.url,
      connectTimeout: 5000,
      tlsOptions: { rejectUnauthorized: false },
    });

    try {
      await userClient.bind(userDn, password);
    } catch {
      return null;
    } finally {
      try { await userClient.unbind(); } catch { /* ignore */ }
    }

    return {
      dn: userDn,
      email: getAttrValue(entry, config.attrEmail) || email,
      firstName: getAttrValue(entry, config.attrFirstName) || "Unknown",
      surname: getAttrValue(entry, config.attrSurname) || "User",
    };
  } catch {
    return null;
  } finally {
    try { await client.unbind(); } catch { /* ignore */ }
  }
}

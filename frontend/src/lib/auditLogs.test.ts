import { describe, expect, it } from "vitest";

import {
  actionLabel,
  auditChanges,
  buildNameLookup,
  historyHref,
  isCreation,
  pageSummary,
  parseAuditTarget,
  recordName,
  type AuditLog,
} from "./auditLogs";

function log(overrides: Partial<AuditLog>): AuditLog {
  return {
    id: 1,
    action: "DEPARTMENT_UPDATED",
    entity_type: "DEPARTMENT",
    entity_id: 4,
    actor_id: 1,
    actor_name: "Sistem Yöneticisi",
    before: { name: "Destek" },
    after: { name: "Destek Hizmetleri" },
    ip_address: "10.0.0.5",
    created_at: "2026-10-12T11:32:00Z",
    ...overrides,
  };
}

const lookup = buildNameLookup({
  users: [{ id: 7, full_name: "Elif Arslan" }],
  departments: [
    { id: 1, name: "Destek Hizmetleri Şube Müdürlüğü" },
    { id: 4, name: "Beslenme Hizmetleri" },
  ],
  locations: [{ id: 9, name: "B Blok" }],
  caseTypes: [{ id: 3, name: "Elektrik arızası", code: "ELECTRICAL_FAILURE" }],
  slaRules: [
    { id: 6, case_type_id: 3, priority: "HIGH", response_minutes: 15, resolution_minutes: 120, warning_threshold_pct: 75, is_active: true },
  ],
  agentPolicies: [
    { id: 3, scope: "CASE_TYPE", case_type_id: 3, category: null, autonomy_level: "L3_ESCALATE", min_confidence_auto: 0.7, notify_manager: true, is_active: true },
  ],
});

describe("actionLabel", () => {
  it("says what happened to which kind of record", () => {
    expect(actionLabel(log({}))).toBe("Birim güncellendi");
    expect(actionLabel(log({ action: "SLA_RULE_CREATED", entity_type: "SLA_RULE" }))).toBe("Süre hedefi eklendi");
    expect(actionLabel(log({ action: "AGENT_POLICY_UPDATED", entity_type: "AGENT_POLICY" }))).toBe(
      "Yapay zekâ politikası güncellendi",
    );
  });

  it("falls back to the raw action when the verb is unknown", () => {
    expect(actionLabel(log({ action: "DEPARTMENT_ARCHIVED" }))).toBe("DEPARTMENT_ARCHIVED");
  });
});

describe("recordName", () => {
  it("names the record from the current lists", () => {
    expect(recordName(log({}), lookup)).toBe("Beslenme Hizmetleri");
    expect(recordName(log({ entity_type: "USER", entity_id: 7 }), lookup)).toBe("Elif Arslan");
    expect(recordName(log({ entity_type: "SLA_RULE", entity_id: 6 }), lookup)).toBe("Elektrik arızası · Yüksek");
    expect(recordName(log({ entity_type: "AGENT_POLICY", entity_id: 3 }), lookup)).toBe("Elektrik arızası");
  });

  it("uses the name written in the entry, then the record number, when the list does not have it", () => {
    const created = log({ entity_id: 99, before: null, after: { id: 99, name: "Kütüphane", code: "LIBRARY" } });
    expect(recordName(created, lookup)).toBe("Kütüphane");
    expect(recordName(log({ entity_id: 99 }), buildNameLookup({}))).toBe("Destek Hizmetleri");
    expect(recordName(log({ entity_id: 99, before: { is_active: true }, after: { is_active: false } }), lookup)).toBe("#99");
  });
});

describe("auditChanges", () => {
  const changes = (entry: Partial<AuditLog>) =>
    auditChanges(log(entry), lookup).map((change) => `${change.label}: ${change.before} → ${change.after}`);

  it("writes each changed field as before and after", () => {
    expect(changes({})).toEqual(["Ad: Destek → Destek Hizmetleri"]);
    expect(changes({ before: { is_active: true }, after: { is_active: false } })).toEqual(["Durum: Aktif → Pasif"]);
  });

  it("turns codes, ids and numbers into the words the screens use", () => {
    expect(
      changes({
        entity_type: "USER",
        before: { role: "STAFF", department_id: 1 },
        after: { role: "MANAGER", department_id: 4 },
      }),
    ).toEqual(["Rol: Personel → Birim müdürü", "Birim: Destek Hizmetleri Şube Müdürlüğü → Beslenme Hizmetleri"]);
    expect(
      changes({
        entity_type: "SLA_RULE",
        before: { resolution_minutes: 120, warning_threshold_pct: 75 },
        after: { resolution_minutes: 180, warning_threshold_pct: 70 },
      }),
    ).toEqual(["Çözüm hedefi: 2 saat → 3 saat", "Uyarı eşiği: %75 → %70"]);
    expect(
      changes({
        entity_type: "AGENT_POLICY",
        before: { autonomy_level: "L1_AUTONOMOUS", min_confidence_auto: 0.7, notify_manager: false },
        after: { autonomy_level: "L2_NOTIFY", min_confidence_auto: 0.85, notify_manager: true },
      }),
    ).toEqual([
      "Karar yetkisi: Kendi uygular → Uygular, müdüre haber verir",
      "Güven eşiği: %70 → %85",
      "Müdüre haber: Hayır → Evet",
    ]);
  });

  it("shows removed values, lists and unknown fields without breaking", () => {
    expect(
      changes({
        entity_type: "CASE_TYPE",
        before: { default_department_id: 1, keywords: ["priz"], future_field: 1 },
        after: { default_department_id: null, keywords: ["priz", "sigorta"], future_field: 2 },
      }),
    ).toEqual(["Görevi alan birim: Destek Hizmetleri Şube Müdürlüğü → –", "Anahtar kelimeler: priz → priz, sigorta", "future_field: 1 → 2"]);
  });

  it("lists the fields of a new record without a before value, leaving out the id", () => {
    const created = log({ action: "DEPARTMENT_CREATED", before: null, after: { id: 9, code: "LIBRARY", name: "Kütüphane", is_active: true } });

    expect(isCreation(created)).toBe(true);
    expect(isCreation(log({}))).toBe(false);
    expect(auditChanges(created, lookup)).toEqual([
      { label: "Kod", before: null, after: "LIBRARY" },
      { label: "Ad", before: null, after: "Kütüphane" },
      { label: "Durum", before: null, after: "Aktif" },
    ]);
  });
});

describe("history links", () => {
  it("builds and reads the single-record filter", () => {
    expect(historyHref("CASE_TYPE", 12)).toBe("/admin/audit-logs?entity_type=CASE_TYPE&entity_id=12");
    expect(parseAuditTarget({ entity_type: "CASE_TYPE", entity_id: "12" })).toEqual({ entityType: "CASE_TYPE", entityId: 12 });
  });

  it.each([
    [{}],
    [{ entity_type: "CASE_TYPE" }],
    [{ entity_type: "PLANET", entity_id: "3" }],
    [{ entity_type: "CASE_TYPE", entity_id: "abc" }],
    [{ entity_type: ["USER", "LOCATION"], entity_id: "3" }],
  ])("ignores an incomplete or unknown filter %j", (params) => {
    expect(parseAuditTarget(params)).toBeNull();
  });
});

describe("pageSummary", () => {
  it("says which records are on the page", () => {
    expect(pageSummary({ page: 1, pageSize: 50, total: 312 })).toBe("1–50 / 312 kayıt");
    expect(pageSummary({ page: 7, pageSize: 50, total: 312 })).toBe("301–312 / 312 kayıt");
    expect(pageSummary({ page: 1, pageSize: 50, total: 8 })).toBe("8 kayıt");
  });
});

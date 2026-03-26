#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(
  __dirname,
  "..",
  "node_modules",
  "@capgo",
  "capacitor-health",
  "ios",
  "Sources",
  "HealthPlugin",
  "Health.swift"
);

if (!fs.existsSync(filePath)) {
  console.error(`[patch] Fichier introuvable: ${filePath}`);
  process.exit(1);
}

let content = fs.readFileSync(filePath, "utf8");

const requireMarker = (source, marker, step) => {
  if (!source.includes(marker)) {
    throw new Error(`[patch] ${step}: marqueur introuvable: ${marker}`);
  }
};

const updateBlock = (source, startMarker, endMarker, transform, step) => {
  requireMarker(source, startMarker, step);
  requireMarker(source, endMarker, step);
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (end < 0) throw new Error(`[patch] ${step}: fin de bloc introuvable`);
  const head = source.slice(0, start);
  const block = source.slice(start, end);
  const tail = source.slice(end);
  return head + transform(block) + tail;
};

const ensureBefore = (block, beforeNeedle, insertion, step) => {
  if (block.includes(insertion)) return block;
  if (!block.includes(beforeNeedle)) throw new Error(`[patch] ${step}: ancre introuvable`);
  return block.replace(beforeNeedle, `${insertion}${beforeNeedle}`);
};

try {
  // 1) enum HealthDataType
  content = updateBlock(
    content,
    "enum HealthDataType: String, CaseIterable {",
    "    func sampleType() throws -> HKSampleType {",
    (block) => {
      let out = block;
      out = ensureBefore(out, "    case basalBodyTemperature\n", "    case dietaryProtein\n", "enum dietaryProtein");
      out = ensureBefore(out, "    case basalBodyTemperature\n", "    case dietaryCarbohydrates\n", "enum dietaryCarbohydrates");
      out = ensureBefore(out, "    case basalBodyTemperature\n", "    case dietaryFat\n", "enum dietaryFat");
      out = ensureBefore(out, "    case basalBodyTemperature\n", "    case dietaryEnergyConsumed\n", "enum dietaryEnergyConsumed");
      return out;
    },
    "patch enum"
  );

  // 2) quantityType mapping
  content = updateBlock(
    content,
    "    func quantityType() throws -> HKQuantityType {",
    "    var defaultUnit: HKUnit {",
    (block) => {
      let out = block;
      out = out.replace(/case \.dietaryEnergyConsumed:\s*\n\s*return HKUnit\.kilocalorie\(\)\s*\n/g, "");
      out = out.replace(/case \.dietaryEnergyConsumed:\s*\n\s*return "kilocalorie"\s*\n/g, "");
      out = ensureBefore(
        out,
        "        case .basalBodyTemperature:\n",
        "        case .dietaryProtein:\n            identifier = .dietaryProtein\n",
        "quantity dietaryProtein"
      );
      out = ensureBefore(
        out,
        "        case .basalBodyTemperature:\n",
        "        case .dietaryCarbohydrates:\n            identifier = .dietaryCarbohydrates\n",
        "quantity dietaryCarbohydrates"
      );
      out = ensureBefore(
        out,
        "        case .basalBodyTemperature:\n",
        "        case .dietaryFat:\n            identifier = .dietaryFatTotal\n",
        "quantity dietaryFat"
      );
      out = ensureBefore(
        out,
        "        case .basalBodyTemperature:\n",
        "        case .dietaryEnergyConsumed:\n            identifier = .dietaryEnergyConsumed\n",
        "quantity dietaryEnergyConsumed"
      );
      return out;
    },
    "patch quantityType"
  );

  // 3) defaultUnit
  content = updateBlock(
    content,
    "    var defaultUnit: HKUnit {",
    "    var unitIdentifier: String {",
    (block) => {
      let out = block;
      out = ensureBefore(
        out,
        "        case .basalCalories:\n",
        "        case .dietaryProtein, .dietaryCarbohydrates, .dietaryFat:\n            return HKUnit.gram()\n",
        "defaultUnit macros"
      );
      out = ensureBefore(
        out,
        "        case .basalCalories:\n",
        "        case .dietaryEnergyConsumed:\n            return HKUnit.kilocalorie()\n",
        "defaultUnit dietaryEnergyConsumed"
      );
      return out;
    },
    "patch defaultUnit"
  );

  // 4) unitIdentifier
  content = updateBlock(
    content,
    "    var unitIdentifier: String {",
    "    static func parseMany(_ identifiers: [String]) throws -> [HealthDataType] {",
    (block) => {
      let out = block;
      out = ensureBefore(
        out,
        "        case .basalCalories:\n",
        "        case .dietaryProtein, .dietaryCarbohydrates, .dietaryFat:\n            return \"gram\"\n",
        "unitIdentifier macros"
      );
      out = ensureBefore(
        out,
        "        case .basalCalories:\n",
        "        case .dietaryEnergyConsumed:\n            return \"kilocalorie\"\n",
        "unitIdentifier dietaryEnergyConsumed"
      );
      return out;
    },
    "patch unitIdentifier"
  );
} catch (err) {
  console.error(String(err));
  process.exit(1);
}

fs.writeFileSync(filePath, content, "utf8");
console.log("[patch] Health.swift patché avec succès — nutrition read types + unités alignés");

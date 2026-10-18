/*
 * SPDX-License-Identifier: MPL-2.0
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 *
 * Adapted from @aiden0z/pptx-renderer 1.3.0, commit
 * 0cf5c194b4db2cf9f2531b6a7e24a61338caabf1,
 * src/renderer/predefinedTableStyles.ts. Upstream identifies derivation
 * from LibreOffice predefined-table-styles.cxx (MPL-2.0).
 * Source, changes and upstream package license: presentationTableBuiltinStyle.SOURCES.md.
 */

import { builtinTableStyleDefinitions } from "./presentationTableBuiltinStyleData";
import { builtinTableStyleGenerators } from "./presentationTableBuiltinStyleXml";

/** Fixed 74-style reference catalog; this is not every Office version or custom style. */
export const presentationTableBuiltinStyleIds: readonly string[] =
  Object.freeze([...builtinTableStyleDefinitions.keys()]);

/** Return an independent complete definition; never mutate a package or theme. */
export function presentationTableBuiltinStyle(id: string): string | undefined {
  const canonical = id.trim().toUpperCase();
  const definition = builtinTableStyleDefinitions.get(canonical);
  if (!definition) return undefined;
  const [name, accent] = definition;
  return builtinTableStyleGenerators[name]?.(accent, canonical);
}

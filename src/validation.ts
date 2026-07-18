// Copyright 2025 Timandes White
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

export function requireNonEmptyString(
  name: string,
  value: unknown,
): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${name}参数不能为空字符串`);
  }
}

export function requirePositiveInteger(
  name: string,
  value: unknown,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new RangeError(`${name}参数必须是正整数`);
  }
}

export function requireNonNegativeInteger(
  name: string,
  value: unknown,
): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name}参数必须是非负整数`);
  }
}

export function copyRecordList(
  name: string,
  value: unknown,
): Array<Record<string, unknown>> {
  if (
    !Array.isArray(value) ||
    value.some((item) =>
      typeof item !== 'object' || item === null || Array.isArray(item))
  ) {
    throw new TypeError(`${name}参数必须是对象列表`);
  }
  return value.map((item) => ({ ...(item as Record<string, unknown>) }));
}

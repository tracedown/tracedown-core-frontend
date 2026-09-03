<template>
    <div>
      <div class="flex items-center gap-1 mb-1">
        <label class="text-xs font-medium text-text-secondary">{{ t('service.window') }}</label>
        <HelpTooltip :entries="help" />
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <AppSelect
          v-model="frequency"
          class="w-36"
          :options="frequencyOptions"
        />
        <template v-if="isRange">
          <!--  Every select goes full width below the breakpoint, so each
                hour:minute pair claims its own row and splits it.  -->
          <div class="flex items-center gap-1 max-md:w-full">
            <AppSelect
              v-model="startHour"
              class="w-18 max-md:flex-1"
              :options="hourOptions"
            />
            <span class="text-xs text-text-secondary">:</span>
            <AppSelect
              v-model="startMinute"
              class="w-18 max-md:flex-1"
              :options="minuteOptions"
            />
          </div>
          <span class="text-xs text-text-secondary">&ndash;</span>
          <div class="flex items-center gap-1 max-md:w-full">
            <AppSelect
              v-model="endHour"
              class="w-18 max-md:flex-1"
              :options="hourOptions"
            />
            <span class="text-xs text-text-secondary">:</span>
            <AppSelect
              v-model="endMinute"
              class="w-18 max-md:flex-1"
              :options="minuteOptions"
            />
          </div>
          <AppSelect
            v-model="timezone"
            class="w-44"
            searchable
            :options="TIMEZONE_OPTIONS"
          />
        </template>
      </div>

      <!-- Weekday multi-select -->
      <div
        v-if="frequency === 'weekly'"
        class="flex flex-wrap items-center gap-1.5 mt-2"
      >
        <BadgePill
          v-for="day in WINDOW_DAYS"
          :key="day"
          interactive
          :color-class="days.includes(day)
            ? 'bg-accent-primary/15 text-accent-primary'
            : 'bg-text-primary/10 text-text-secondary hover:text-text-primary'"
          :label="t(`service.daysShort.${day}`)"
          @click="toggleDay(day)"
        />
        <p
          v-if="days.length === 0"
          class="text-xs text-status-failure w-full"
        >
          {{ t('service.windowNoDays') }}
        </p>
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue';
import { useI18n } from 'vue-i18n';
import AppSelect from '@/components/core/input/AppSelect.vue';
import BadgePill from '@/components/core/BadgePill.vue';
import HelpTooltip from '@/components/core/HelpTooltip.vue';
import { TIMEZONE_OPTIONS } from '@/lib/timezones';
import { useAuthStore } from '@/store/core/auth';
import {
  WINDOW_DAYS, buildServiceWindowRule, parseServiceWindowRule,
} from '@/lib/serviceWindow';
import type { WindowDay, WindowFrequency, WindowTime } from '@/lib/serviceWindow';
import type { HelpEntry } from '@/types/ui/help';
import type { SelectOption } from '@/types/ui/common';

/**
 * Maintenance-window builder. The model is the encoded RRULE ('' = none);
 * a rule the minimal model can't express shows as "custom" and passes
 * through untouched unless replaced. Times are minute-precise; a range whose
 * end lies at or before the start crosses midnight.
 */
const model = defineModel<string>({ required: true });
/** False while the selection can't form a rule (weekly with no days). */
const valid = defineModel<boolean>('valid', { default: true });

const { t } = useI18n();
const authStore = useAuthStore();

const parsed = parseServiceWindowRule(model.value || null);
const isCustom = ref<boolean>(!!model.value && !parsed);

const frequency = ref<string>(parsed?.frequency ?? (isCustom.value ? 'custom' : 'none'));
const days = ref<WindowDay[]>(parsed?.days ?? []);
const start = ref<WindowTime>(parsed?.start ?? { hours: 2, minutes: 0 });
const end = ref<WindowTime>(parsed?.end ?? { hours: 3, minutes: 0 });
// Legacy zoneless windows evaluate in the org default — prefill exactly
// that, so the next save writes it out explicitly.
const timezone = ref<string>(parsed?.timezone ?? authStore.orgDefaultTimezone);

// The last rule this editor itself wrote to the model. An incoming model
// value that differs was set externally (e.g. a clear from a sibling) and
// must re-seed the selection; matching values are our own echo and are
// ignored so in-progress local edits are never clobbered.
let lastEmitted = model.value;

watch(model, (value) => {
  if (value === lastEmitted) return;
  const external = parseServiceWindowRule(value || null);
  isCustom.value = !!value && !external;
  frequency.value = external?.frequency ?? (isCustom.value ? 'custom' : 'none');
  days.value = external?.days ?? [];
  if (external) {
    start.value = external.start;
    end.value = external.end;
    timezone.value = external.timezone ?? authStore.orgDefaultTimezone;
  }
  lastEmitted = value;
});

const isRange = computed(() => frequency.value === 'daily' || frequency.value === 'weekly');

const frequencyOptions = computed<SelectOption[]>(() => [
  { value: 'none', label: t('service.windowOff') },
  { value: 'daily', label: t('service.windowDaily') },
  { value: 'weekly', label: t('service.windowWeekly') },
  ...(isCustom.value ? [{ value: 'custom', label: t('service.windowCustom') }] : []),
]);

const help = computed<HelpEntry[]>(() => [
  { term: t('service.windowBehavior'), description: t('service.windowBehaviorHelp') },
  { term: t('service.windowTimes'), description: t('service.windowTimesHelp') },
]);

function toggleDay(day: WindowDay) {
  days.value = days.value.includes(day)
    ? days.value.filter(d => d !== day)
    : [...days.value, day];
}

const pad = (n: number) => String(n).padStart(2, '0');

const hourOptions = computed<SelectOption[]>(() =>
  Array.from({ length: 24 }, (_, hour) => ({ value: String(hour), label: pad(hour) })));

const minuteOptions = computed<SelectOption[]>(() =>
  Array.from({ length: 12 }, (_, i) => ({ value: String(i * 5), label: pad(i * 5) })));

function timeField(time: typeof start, field: keyof WindowTime) {
  return computed<string>({
    get: () => String(time.value[field]),
    set: (value) => {
      time.value = { ...time.value, [field]: Number(value) };
    },
  });
}

const startHour = timeField(start, 'hours');
const startMinute = timeField(start, 'minutes');
const endHour = timeField(end, 'hours');
const endMinute = timeField(end, 'minutes');

// Equal times are ambiguous (0 or 24h) — bump the end one hour ahead. An end
// "before" the start is valid: the window crosses midnight.
function samePoint(a: WindowTime, b: WindowTime): boolean {
  return a.hours === b.hours && a.minutes === b.minutes;
}
watch([start, end], ([startTime, endTime]) => {
  if (samePoint(startTime, endTime)) {
    end.value = { hours: (endTime.hours + 1) % 24, minutes: endTime.minutes };
  }
});

watchEffect(() => {
  valid.value = frequency.value !== 'weekly' || days.value.length > 0;
});

// Re-encode the model on every selection change; custom rules pass through.
watchEffect(() => {
  if (frequency.value === 'custom') return;
  if (frequency.value === 'none') {
    lastEmitted = '';
    model.value = '';
    return;
  }
  if (frequency.value === 'weekly' && days.value.length === 0) return;
  const rule = buildServiceWindowRule({
    frequency: frequency.value as WindowFrequency,
    days: days.value,
    start: { hours: start.value.hours, minutes: start.value.minutes },
    end: { hours: end.value.hours, minutes: end.value.minutes },
    timezone: timezone.value,
  });
  lastEmitted = rule;
  model.value = rule;
});
</script>

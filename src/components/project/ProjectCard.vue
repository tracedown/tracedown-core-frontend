<template>
    <router-link
      :to="{ name: 'project', params: { projectId: project.id } }"
      class="block p-4 bg-background-secondary border border-text-secondary/50 rounded
           hover:border-accent-primary/50 transition-colors"
    >
      <div class="flex items-center gap-1.5 mb-3">
        <h3 class="text-sm font-medium text-text-primary truncate">
          {{ project.name }}
        </h3>
        <SilenceBell
          resource-type="project"
          :resource-id="project.id"
          :parent-keys="[`workspace::${project.workspaceId}`]"
          @click.prevent
        />
        <span class="ml-auto" />
        <span
          class="w-1.5 h-1.5 rounded-full shrink-0"
          :class="statusDot"
        />
      </div>
      <!--  `min-w-0` on the cells and a block label: an inline label wider than
            its column keeps its intrinsic width, and the three stats ran into
            each other as soon as the card narrowed.  -->
      <div class="grid grid-cols-3 gap-3 text-xs">
        <div class="min-w-0">
          <span class="block text-text-secondary break-words">{{ t('common.entities.services') }}</span>
          <p class="text-text-primary font-medium mt-0.5">
            {{ project.serviceCount ?? 0 }}
          </p>
        </div>
        <div class="min-w-0">
          <span class="block text-text-secondary break-words">{{ t('metrics.totalProbes') }}</span>
          <p class="text-text-primary font-medium mt-0.5">
            {{ totalProbes }}
          </p>
        </div>
        <div class="min-w-0">
          <span class="block text-text-secondary break-words">{{ t('metrics.successRate') }}</span>
          <p
            class="font-medium mt-0.5"
            :style="metricsSuccessStyle(project.metrics)"
          >
            {{ successRate }}
          </p>
        </div>
      </div>
    </router-link>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';
import { computeSuccessRate, metricsSuccessStyle, statusDotClass } from '@/lib/metrics-utils';
import type { ProjectSummary } from '@/data/projects/ProjectDto';
import SilenceBell from '@/components/core/notifications/SilenceBell.vue';

const props = defineProps<{
  project: ProjectSummary;
}>();

const { t } = useI18n();

const totalProbes = computed(() =>
  props.project.metrics?.counters.probesTotal.toLocaleString() ?? '-');

const successRate = computed(() => {
  const rate = computeSuccessRate(props.project.metrics);
  return rate == null ? '-' : `${rate.toFixed(1)}%`;
});

/**
 * The project's last probe status. The Active/Inactive wording that used to sit
 * beside this dot came from `projects.is_active`, a column that was true for
 * every project ever created — so it always read "Active" and told the reader
 * nothing. Dot only now, matching ServiceListItem.
 */
const statusDot = computed(() => statusDotClass(props.project.metrics?.state.lastStatus));
</script>

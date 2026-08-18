<template>
    <div
      class="w-full h-headbar
    bg-background-secondary border-b border-b-accent-primary
    flex items-center"
    >
      <!--  Logo: same width as the nav ribbon so the columns align    -->
      <router-link
        :to="{ name: 'home' }"
        class="w-sidebar shrink-0 h-full px-gutter flex items-center gap-2
             text-accent-primary font-bold text-lg select-none"
      >
        <img
          src="/logo.svg"
          :alt="appConfig.appName"
          class="h-6 w-6 shrink-0"
        >
        {{ appConfig.appName }}
      </router-link>

      <div class="flex-1 min-w-0 h-full px-gutter flex items-center justify-between gap-4">
        <!--  Org / workspace context    -->
        <div class="flex items-center gap-2 shrink-0">
          <OrgSelect />
          <div class="w-px h-5 bg-text-secondary/50" />
          <WorkspaceSelect />
        </div>

        <!--  Searchbar    -->
        <div class="max-w-2/5 w-full">
          <SearchBar v-if="searchStore.active" />
        </div>

        <!--  Health + user handle    -->
        <div class="flex items-center gap-3 shrink-0">
          <AgentHealthIndicator />
          <div class="w-px h-5 bg-text-secondary/50" />
          <!--  Inline slot: a host application can inject header action icons
                here (icon-sized, right-aligned, beside the user menu).  -->
          <div class="flex items-center gap-3 empty:hidden">
            <SlotOutlet name="headbar-actions" />
          </div>
          <UserMenu />
        </div>
      </div>
    </div>
</template>

<script setup lang="ts">
import { useSearchStore } from "@/store/ui/search";
import { appConfig } from "@/app.config";
import SearchBar from "@/components/core/search/SearchBar.vue";
import OrgSelect from "@/components/layout/navigation/OrgSelect.vue";
import WorkspaceSelect from "@/components/layout/navigation/WorkspaceSelect.vue";
import AgentHealthIndicator from "@/components/layout/navigation/AgentHealthIndicator.vue";
import UserMenu from "@/components/layout/navigation/UserMenu.vue";
import SlotOutlet from "@/components/core/SlotOutlet.vue";

const searchStore = useSearchStore();
</script>

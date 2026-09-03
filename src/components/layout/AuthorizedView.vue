<template>
    <div class="full flex justify-center bg-grid">
      <!--   Layout   -->
      <div class="max-w-425 full">
        <!--   Chrome: the desktop headbar + ribbon, or the phone top bar +
               slide-in drawer. One breakpoint decides (useViewport).   -->
        <MobileTopBar
          v-if="isMobile"
          class="sticky top-0 z-40"
          :menu-open="drawerOpen"
          @open-menu="drawerOpen = true"
        />
        <NavHeadbar
          v-else
          class="sticky top-0 z-40"
        />
        <!--   Platform alert banners (admins only; per-user dismissable)   -->
        <SystemAlertBanners />
        <!--    Main content    -->
        <div class="full flex">
          <NavSidebar v-if="!isMobile" />
          <!--    Router — deliberately unpadded: each view owns its spacing,
                  so flush layouts (e.g. the service list) can hug the ribbon.  -->
          <div class="w-full min-w-0">
            <router-view />
          </div>
        </div>
      </div>

      <MobileNavDrawer
        v-if="isMobile && drawerOpen"
        @close="drawerOpen = false"
      />

      <!--   Host-mounted floating widget slot (empty unless a host registers).   -->
      <SlotOutlet name="support-widget" />

      <!--   Host-mounted overlays above the app — dialogs and one-off prompts.
             Rendered inside the authorized shell so they only ever appear to a
             signed-in user, and after the session has been hydrated.   -->
      <SlotOutlet name="app-overlay" />

      <!--   Global request spinner (store-driven)   -->
      <LoadingOverlay v-if="loadingStore.isLoading" />

      <!--   Org-wide live sync (renderless; re-acquires on org switch)   -->
      <OrgLiveSync
        v-if="orgStore.selectedOrgId"
        :key="orgStore.selectedOrgId"
        :org-id="orgStore.selectedOrgId"
      />
    </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import SlotOutlet from "@/components/core/SlotOutlet.vue";
import MobileNavDrawer from "@/components/layout/navigation/MobileNavDrawer.vue";
import MobileTopBar from "@/components/layout/navigation/MobileTopBar.vue";
import NavHeadbar from "@/components/layout/navigation/NavHeadbar.vue";
import NavSidebar from "@/components/layout/navigation/NavSidebar.vue";
import OrgLiveSync from "@/components/layout/OrgLiveSync.vue";
import SystemAlertBanners from "@/components/layout/SystemAlertBanners.vue";
import LoadingOverlay from "@/components/layout/LoadingOverlay.vue";
import { useViewport } from "@/composables/useViewport";
import { useOrgStore } from "@/store/core/org";
import { useLoadingStore } from "@/store/ui/loading";

const orgStore = useOrgStore();
const loadingStore = useLoadingStore();

const { isMobile } = useViewport();

// Owned here rather than in a store: the trigger and the panel are both
// children of this shell, and nothing else in the app opens the drawer.
const drawerOpen = ref<boolean>(false);

// Rotating the phone to landscape (or resizing a desktop window down through
// the breakpoint) must not leave a drawer stranded over the desktop layout.
watch(isMobile, (mobile) => {
  if (!mobile) drawerOpen.value = false;
});
</script>

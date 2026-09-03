<template>
    <div
      class="min-w-12 w-full rounded-lg
             flex items-center gap-6 justify-between
            bg-accent-secondary text-text-primary"
      :class="[wrapperClass, compact ? 'h-8' : '', 'max-md:w-full']"
    >
      <div class="w-full flex items-center min-w-0">
        <span
          v-if="prefix"
          class="pl-2 text-text-primary select-none
                 shrink-0 h-8 rounded-l-lg flex items-center justify-center
                 bg-background-secondary border border-background-primary"
          :class="compact ? 'text-sm' : ''"
        >{{ prefix }}</span>
        <input
          v-model="value"
          v-bind="inputAttrs"
          class="w-full placeholder:text-text-secondary
               focus:outline-none focus:ring-accent-primary"
          :class="inputPaddingClass"
          :type="inputType"
          :placeholder="placeholder"
          :disabled="disabled"
          :name="name"
          :autocomplete="autocomplete"
          :required="required"
        >
      </div>

      <div
        v-if="type == 'password'"
        class="mr-2 text-accent-primary flex items-center select-none"
        @mousedown.prevent
        @click="toggleShowText()"
      >
        <FontAwesomeIcon :icon="pwIcon" size="lg" />
      </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref, useAttrs } from "vue";
import { faEye, faEyeSlash } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";

// Layout classes stay on the wrapper; every other stray attr (id, aria-*, …) falls through to the
// input so <label for> resolves.
defineOptions({ inheritAttrs: false });

const attrs = useAttrs();
const wrapperClass = computed(() => attrs.class);
const inputAttrs = computed(() => {
  const rest = { ...attrs };
  delete rest.class;
  return rest;
});

const props = withDefaults(
  defineProps<{
    type?: 'text' | 'number' | 'password' | 'email';
    placeholder?: string;
    disabled?: boolean;
    name?: string | undefined;
    autocomplete?: string;
    required?: boolean;
    /** h-8 control matching button/select height, for dense form rows. */
    compact?: boolean;
    /** Static lead-in rendered inside the field, e.g. a variable key prefix. */
    prefix?: string;
  }>(),
  {
    type: 'text',
    placeholder: '',
    disabled: false,
    name: undefined,
    autocomplete: 'on',
    required: false,
    compact: false,
    prefix: undefined,
  }
);

/** With a prefix the input hugs it (pl-1) instead of double-padding the seam. */
const inputPaddingClass = computed(() => {
  if (props.compact) return props.prefix ? 'pl-1 pr-2 py-1 text-sm' : 'px-2 py-1 text-sm';
  return props.prefix ? 'pl-1 pr-2 py-2' : 'p-2';
});

const value = defineModel<string | number>('modelValue');

const showText = ref<boolean>(props.type != 'password');

const toggleShowText = () => {
  showText.value = !showText.value;
};

const inputType = computed(
  () =>
    props.type != 'password' ? props.type :
      showText.value ? 'text' : 'password'
);

const pwIcon = computed(
  () => showText.value ? faEyeSlash : faEye
);
</script>

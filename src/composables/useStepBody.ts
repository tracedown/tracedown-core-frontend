import { computed, ref, type Ref } from 'vue';
import { useI18n } from 'vue-i18n';
import { downloadBlob } from '@/lib/fileDownload';
import { bodyFileName, decideBodyDisplay, layOutJsonBody } from '@/utils/resultBodies';
import { useResultStore } from '@/store/core/result';
import { useNotificationStore } from '@/store/ui/notifications';
import type { ProbeStepSummary } from '@/data/results/ResultDto';

/** How many bytes of a binary body are shown as hex — enough to recognise a format. */
const HEX_PREVIEW_BYTES = 96;

/** What the step detail panel needs to show, hide and save one response body. */
export interface StepBody {
  visible: Ref<boolean>;
  downloading: Ref<boolean>;
  /** The verdict from the step's recorded size alone, before anything is fetched. */
  recordedDisplay: Ref<'format' | 'wrap' | 'binary' | 'too-large'>;
  /** The verdict once the body has arrived. */
  display: Ref<'format' | 'wrap' | 'binary' | 'too-large'>;
  /** The body as it is shown — laid out when it is JSON, untouched otherwise. */
  shown: Ref<string>;
  binary: Ref<{ notice: string; preview: string } | null>;
  show(): void;
  hide(): void;
  download(): Promise<void>;
}

/**
 * The response-body half of a probe step: what to do with it, and how to get
 * a copy of it.
 *
 * Lives apart from the panel because it is policy rather than markup — which
 * bodies are drawn, which are described, and where the bytes behind the
 * download come from — and the panel had grown two jobs.
 */
export function useStepBody(
  step: () => ProbeStepSummary,
  ids: () => { serviceId: string; resultId: string; serviceName?: string },
): StepBody {
  const { t } = useI18n();
  const resultStore = useResultStore();
  const notifications = useNotificationStore();

  const visible = ref<boolean>(false);
  const downloading = ref<boolean>(false);

  /**
   * What the step itself says about the body, before any of it is fetched.
   *
   * A body the step records as being over the display limit is never
   * requested: the answer could only be thrown away, and on a big one that is
   * a real transfer spent to render nothing. The download fetches it on its
   * own when it is actually wanted.
   */
  const recordedDisplay = computed(() =>
    decideBodyDisplay({ sizeBytes: step().responseSizeBytes }));

  /** The same decision once the body is here, which settles a wrong recorded size. */
  const display = computed(() => decideBodyDisplay({
    sizeBytes: step().responseSizeBytes,
    encoding: resultStore.stepBodyEncoding,
    text: resultStore.stepBody,
  }));

  /**
   * The text body as it is shown: JSON gets line breaks and indentation, and
   * nothing else changes — no value is re-serialised, so what is on screen is
   * still exactly what the check received. Keyed on the body itself, so the
   * walk runs once when it arrives rather than on every render of the panel.
   */
  const shown = computed(() => layOutJsonBody(resultStore.stepBody));

  /**
   * A base64 body described rather than rendered: its size, its media type
   * when the store knew one, and the first bytes as hex so a PNG or a gzip
   * stream is recognisable without downloading anything.
   */
  const binary = computed<{ notice: string; preview: string } | null>(() => {
    const content = resultStore.stepBody;
    if (resultStore.stepBodyEncoding !== 'base64' || !content) return null;
    let bytes: Uint8Array;
    try {
      const raw = atob(content);
      bytes = Uint8Array.from(raw, char => char.charCodeAt(0));
    } catch {
      return { notice: t('results.bodyBinaryUnreadable'), preview: '' };
    }
    // No size here: the call's own Size row above already gives it.
    const type = resultStore.stepBodyContentType;
    const notice = type
      ? t('results.bodyBinaryTyped', { type })
      : t('results.bodyBinary');
    const preview = Array.from(bytes.slice(0, HEX_PREVIEW_BYTES))
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join(' ');
    return { notice, preview: bytes.length > HEX_PREVIEW_BYTES ? `${preview} …` : preview };
  });

  function show() {
    visible.value = true;
    void resultStore.fetchStepBody(ids().serviceId, ids().resultId, step().id);
  }

  function hide() {
    visible.value = false;
    resultStore.clearStepBody();
  }

  /**
   * Saves the body as the bytes the check received.
   *
   * Always its own fetch, never the copy on screen: that one may be laid out,
   * may be a base64 transcription, and for a body past the display limit does
   * not exist at all. The file is the record, so it is taken from the source.
   */
  async function download() {
    if (downloading.value) return;
    downloading.value = true;
    try {
      const { serviceId, resultId, serviceName } = ids();
      const res = await resultStore.fetchStepBodyBlob(serviceId, resultId, step().id);
      if (!res.ok || !res.data) {
        notifications.show(res.message ?? t('results.bodyLoadFailed'), 'error');
        return;
      }
      const { blob, contentType, encoding } = res.data;
      // Most bodies carry no content type — the route reports one only when
      // the store recorded it — so the extension falls back to what this side
      // can actually vouch for.
      const fallbackExtension = encoding === 'base64' ? 'bin'
        : display.value === 'format' ? 'json'
          : 'txt';
      downloadBlob(blob, bodyFileName({
        serviceName,
        startedAt: resultStore.selectedResult?.startedAt,
        resultId,
        stepNum: step().stepNum,
        contentType,
        fallbackExtension,
      }));
    } finally {
      downloading.value = false;
    }
  }

  return { visible, downloading, recordedDisplay, display, shown, binary, show, hide, download };
}

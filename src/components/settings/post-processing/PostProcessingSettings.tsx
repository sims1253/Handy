import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { RefreshCcw } from "lucide-react";
import { commands } from "@/bindings";

import { Alert } from "../../ui/Alert";
import {
  Dropdown,
  SettingContainer,
  SettingsGroup,
  Textarea,
} from "@/components/ui";
import { Button } from "../../ui/Button";
import { ResetButton } from "../../ui/ResetButton";
import { Input } from "../../ui/Input";
import { PromptShortcutInput } from "../PostProcessingSettingsApi/PromptShortcutInput";

import { ProviderSelect } from "../PostProcessingSettingsApi/ProviderSelect";
import { BaseUrlField } from "../PostProcessingSettingsApi/BaseUrlField";
import { ApiKeyField } from "../PostProcessingSettingsApi/ApiKeyField";
import { ModelSelect } from "../PostProcessingSettingsApi/ModelSelect";
import { usePostProcessProviderState } from "../PostProcessingSettingsApi/usePostProcessProviderState";
import { ShortcutInput } from "../ShortcutInput";
import { useSettings } from "../../../hooks/useSettings";

const PostProcessingSettingsApiComponent: React.FC = () => {
  const { t } = useTranslation();
  const state = usePostProcessProviderState();

  return (
    <>
      <SettingContainer
        title={t("settings.postProcessing.api.provider.title")}
        description={t("settings.postProcessing.api.provider.description")}
        descriptionMode="tooltip"
        layout="horizontal"
        grouped={true}
      >
        <div className="flex items-center gap-2">
          <ProviderSelect
            options={state.providerOptions}
            value={state.selectedProviderId}
            onChange={state.handleProviderSelect}
          />
        </div>
      </SettingContainer>

      {state.isAppleProvider ? (
        state.appleIntelligenceUnavailable ? (
          <Alert variant="error" contained>
            {t("settings.postProcessing.api.appleIntelligence.unavailable")}
          </Alert>
        ) : null
      ) : (
        <>
          {state.selectedProvider?.id === "custom" && (
            <SettingContainer
              title={t("settings.postProcessing.api.baseUrl.title")}
              description={t("settings.postProcessing.api.baseUrl.description")}
              descriptionMode="tooltip"
              layout="horizontal"
              grouped={true}
            >
              <div className="flex items-center gap-2">
                <BaseUrlField
                  value={state.baseUrl}
                  onBlur={state.handleBaseUrlChange}
                  placeholder={t(
                    "settings.postProcessing.api.baseUrl.placeholder",
                  )}
                  disabled={state.isBaseUrlUpdating}
                  className="min-w-[380px]"
                />
              </div>
            </SettingContainer>
          )}

          <SettingContainer
            title={t("settings.postProcessing.api.apiKey.title")}
            description={t("settings.postProcessing.api.apiKey.description")}
            descriptionMode="tooltip"
            layout="horizontal"
            grouped={true}
          >
            <div className="flex items-center gap-2">
              <ApiKeyField
                value={state.apiKey}
                onBlur={state.handleApiKeyChange}
                placeholder={t(
                  "settings.postProcessing.api.apiKey.placeholder",
                )}
                disabled={state.isApiKeyUpdating}
                className="min-w-[320px]"
              />
            </div>
          </SettingContainer>
        </>
      )}

      {!state.isAppleProvider && (
        <SettingContainer
          title={t("settings.postProcessing.api.model.title")}
          description={
            state.isCustomProvider
              ? t("settings.postProcessing.api.model.descriptionCustom")
              : t("settings.postProcessing.api.model.descriptionDefault")
          }
          descriptionMode="tooltip"
          layout="stacked"
          grouped={true}
        >
          <div className="flex items-center gap-2">
            <ModelSelect
              value={state.model}
              options={state.modelOptions}
              disabled={state.isModelUpdating}
              isLoading={state.isFetchingModels}
              placeholder={
                state.modelOptions.length > 0
                  ? t(
                      "settings.postProcessing.api.model.placeholderWithOptions",
                    )
                  : t("settings.postProcessing.api.model.placeholderNoOptions")
              }
              onSelect={state.handleModelSelect}
              onCreate={state.handleModelCreate}
              onBlur={() => {}}
              className="flex-1 min-w-[380px]"
            />
            <ResetButton
              onClick={state.handleRefreshModels}
              disabled={state.isFetchingModels}
              ariaLabel={t("settings.postProcessing.api.model.refreshModels")}
              className="flex h-10 w-10 items-center justify-center"
            >
              <RefreshCcw
                className={`h-4 w-4 ${state.isFetchingModels ? "animate-spin" : ""}`}
              />
            </ResetButton>
          </div>
        </SettingContainer>
      )}
    </>
  );
};

const CONTEXT_SOURCE_OPTIONS = [
  { value: "none", label: "settings.postProcessing.prompts.contextSource.none" },
  { value: "clipboard", label: "settings.postProcessing.prompts.contextSource.clipboard" },
  { value: "selection", label: "settings.postProcessing.prompts.contextSource.selection" },
  { value: "clipboard_and_selection", label: "settings.postProcessing.prompts.contextSource.clipboardAndSelection" },
] as const;

import type { ContextSource } from "@/bindings";

const PostProcessingSettingsPromptsComponent: React.FC = () => {
  const { t } = useTranslation();
  const {
    getSetting,
    updateSetting,
    isUpdating,
    refreshSettings,
    settings,
    fetchPostProcessModels,
    postProcessModelOptions,
  } = useSettings();
  const [isCreating, setIsCreating] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftText, setDraftText] = useState("");
  const [draftContextSource, setDraftContextSource] =
    useState<ContextSource>("none");
  const [draftShortcut, setDraftShortcut] = useState<string | null>(null);
  const [draftProviderId, setDraftProviderId] = useState<string | null>(null);
  const [draftModel, setDraftModel] = useState<string | null>(null);

  const prompts = getSetting("post_process_prompts") || [];
  const selectedPromptId = getSetting("post_process_selected_prompt_id") || "";
  const selectedPrompt =
    prompts.find((prompt) => prompt.id === selectedPromptId) || null;

  // Providers available for per-prompt override
  const providers = useMemo(
    () => settings?.post_process_providers || [],
    [settings?.post_process_providers],
  );
  const providerOptions = useMemo(
    () => [
      {
        value: "",
        label: t("settings.postProcessing.prompts.providerOverride.global"),
      },
      ...providers.map((p) => ({ value: p.id, label: p.label })),
    ],
    [providers, t],
  );

  // Resolve the effective provider ID for model fetching
  const effectiveProviderId = draftProviderId || "";

  // Per-prompt model options (fetched on demand)
  const perPromptModels = useMemo(
    () => postProcessModelOptions[effectiveProviderId] || [],
    [postProcessModelOptions, effectiveProviderId],
  );

  const isFetchingModels = isUpdating(
    `post_process_models_fetch:${effectiveProviderId}`,
  );

  const handleRefreshPerPromptModels = useCallback(() => {
    if (!effectiveProviderId) return;
    void fetchPostProcessModels(effectiveProviderId);
  }, [effectiveProviderId, fetchPostProcessModels]);

  const modelOptions = useMemo(() => {
    const seen = new Set<string>();
    const options: { value: string; label: string }[] = [];
    const upsert = (v: string | null | undefined) => {
      const trimmed = v?.trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      options.push({ value: trimmed, label: trimmed });
    };
    for (const m of perPromptModels) upsert(m);
    upsert(draftModel);
    return options;
  }, [perPromptModels, draftModel]);

  useEffect(() => {
    if (isCreating) return;

    if (selectedPrompt) {
      setDraftName(selectedPrompt.name);
      setDraftText(selectedPrompt.prompt);
      setDraftContextSource(selectedPrompt.context_source || "none");
      setDraftShortcut(selectedPrompt.shortcut_binding ?? null);
      setDraftProviderId(selectedPrompt.provider_id ?? null);
      setDraftModel(selectedPrompt.model ?? null);
    } else {
      setDraftName("");
      setDraftText("");
      setDraftContextSource("none");
      setDraftShortcut(null);
      setDraftProviderId(null);
      setDraftModel(null);
    }
  }, [
    isCreating,
    selectedPromptId,
    selectedPrompt?.name,
    selectedPrompt?.prompt,
    selectedPrompt?.context_source,
    selectedPrompt?.shortcut_binding,
    selectedPrompt?.provider_id,
    selectedPrompt?.model,
  ]);

  const handlePromptSelect = (promptId: string | null) => {
    if (!promptId) return;
    updateSetting("post_process_selected_prompt_id", promptId);
    setIsCreating(false);
  };

  const handleCreatePrompt = async () => {
    if (!draftName.trim() || !draftText.trim()) return;

    try {
      const result = await commands.addPostProcessPrompt(
        draftName.trim(),
        draftText.trim(),
        draftContextSource,
        draftShortcut,
        draftProviderId,
        draftModel,
      );
      if (result.status === "ok") {
        await refreshSettings();
        updateSetting("post_process_selected_prompt_id", result.data.id);
        setIsCreating(false);
      }
    } catch (error) {
      console.error("Failed to create prompt:", error);
    }
  };

  const handleUpdatePrompt = async () => {
    if (!selectedPromptId || !draftName.trim() || !draftText.trim()) return;

    try {
      await commands.updatePostProcessPrompt(
        selectedPromptId,
        draftName.trim(),
        draftText.trim(),
        draftContextSource,
        draftShortcut,
        draftProviderId,
        draftModel,
      );
      await refreshSettings();
    } catch (error) {
      console.error("Failed to update prompt:", error);
    }
  };

  const handleDeletePrompt = async (promptId: string) => {
    if (!promptId) return;

    try {
      await commands.deletePostProcessPrompt(promptId);
      await refreshSettings();
      setIsCreating(false);
    } catch (error) {
      console.error("Failed to delete prompt:", error);
    }
  };

  const handleCancelCreate = () => {
    setIsCreating(false);
    if (selectedPrompt) {
      setDraftName(selectedPrompt.name);
      setDraftText(selectedPrompt.prompt);
      setDraftContextSource(selectedPrompt.context_source || "none");
      setDraftShortcut(selectedPrompt.shortcut_binding ?? null);
      setDraftProviderId(selectedPrompt.provider_id ?? null);
      setDraftModel(selectedPrompt.model ?? null);
    } else {
      setDraftName("");
      setDraftText("");
      setDraftContextSource("none");
      setDraftShortcut(null);
      setDraftProviderId(null);
      setDraftModel(null);
    }
  };

  const handleStartCreate = () => {
    setIsCreating(true);
    setDraftName("");
    setDraftText("");
    setDraftContextSource("none");
    setDraftShortcut(null);
    setDraftProviderId(null);
    setDraftModel(null);
  };

  const hasPrompts = prompts.length > 0;
  const isDirty =
    !!selectedPrompt &&
    (draftName.trim() !== selectedPrompt.name ||
      draftText.trim() !== selectedPrompt.prompt.trim() ||
      draftContextSource !== (selectedPrompt.context_source || "none") ||
      draftShortcut !== (selectedPrompt.shortcut_binding ?? null) ||
      draftProviderId !== (selectedPrompt.provider_id ?? null) ||
      draftModel !== (selectedPrompt.model ?? null));

  const promptEditorFields = (
    <>
      <div className="space-y-2 flex flex-col">
        <label className="text-sm font-semibold">
          {t("settings.postProcessing.prompts.promptLabel")}
        </label>
        <Input
          type="text"
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder={t(
            "settings.postProcessing.prompts.promptLabelPlaceholder",
          )}
          variant="compact"
        />
      </div>

      <div className="space-y-2 flex flex-col">
        <label className="text-sm font-semibold">
          {t("settings.postProcessing.prompts.promptInstructions")}
        </label>
        <Textarea
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          placeholder={t(
            "settings.postProcessing.prompts.promptInstructionsPlaceholder",
          )}
        />
        <p className="text-xs text-mid-gray/70">
          <Trans
            i18nKey="settings.postProcessing.prompts.promptTipWithVariable"
            components={{ code: <code /> }}
          />
        </p>
      </div>

      <div className="space-y-2 flex flex-col">
        <label className="text-sm font-semibold">
          {t("settings.postProcessing.prompts.contextSource.title")}
        </label>
        <p className="text-xs text-mid-gray/70">
          {t("settings.postProcessing.prompts.contextSource.description")}
        </p>
        <Dropdown
          selectedValue={draftContextSource}
          options={CONTEXT_SOURCE_OPTIONS.map((opt) => ({
            value: opt.value,
            label: t(opt.label),
          }))}
          onSelect={(value: string | null) =>
            setDraftContextSource((value as ContextSource) || "none")
          }
          placeholder={t(
            "settings.postProcessing.prompts.contextSource.none",
          )}
          className="max-w-[280px]"
        />
      </div>

      <div className="space-y-2 flex flex-col">
        <label className="text-sm font-semibold">
          {t("settings.postProcessing.prompts.shortcut.title")}
        </label>
        <p className="text-xs text-mid-gray/70">
          {t("settings.postProcessing.prompts.shortcut.description")}
        </p>
        <PromptShortcutInput
          value={draftShortcut}
          onChange={setDraftShortcut}
        />
      </div>

      <div className="space-y-2 flex flex-col">
        <label className="text-sm font-semibold">
          {t("settings.postProcessing.prompts.providerOverride.title")}
        </label>
        <p className="text-xs text-mid-gray/70">
          {t("settings.postProcessing.prompts.providerOverride.description")}
        </p>
        <div className="flex items-center gap-2 max-w-[380px]">
          <Dropdown
            options={providerOptions}
            selectedValue={draftProviderId || ""}
            onSelect={(value: string | null) => {
              const resolved = value || null;
              setDraftProviderId(resolved);
              // Clear model when provider changes
              setDraftModel(null);
            }}
            placeholder={t(
              "settings.postProcessing.prompts.providerOverride.global",
            )}
            className="flex-1"
          />
        </div>
      </div>

      {draftProviderId && (
        <div className="space-y-2 flex flex-col">
          <label className="text-sm font-semibold">
            {t("settings.postProcessing.prompts.modelOverride.title")}
          </label>
          <p className="text-xs text-mid-gray/70">
            {t("settings.postProcessing.prompts.modelOverride.description")}
          </p>
          <div className="flex items-center gap-2">
            <ModelSelect
              value={draftModel || ""}
              options={modelOptions}
              disabled={isUpdating(
                `post_process_model_override:${effectiveProviderId}`,
              )}
              isLoading={isFetchingModels}
              placeholder={
                modelOptions.length > 0
                  ? t(
                      "settings.postProcessing.api.model.placeholderWithOptions",
                    )
                  : t("settings.postProcessing.api.model.placeholderNoOptions")
              }
              onSelect={(value: string) => setDraftModel(value || null)}
              onCreate={(value: string) => setDraftModel(value || null)}
              onBlur={() => {}}
              className="flex-1 min-w-[380px]"
            />
            <ResetButton
              onClick={handleRefreshPerPromptModels}
              disabled={isFetchingModels}
              ariaLabel={t("settings.postProcessing.api.model.refreshModels")}
              className="flex h-10 w-10 items-center justify-center"
            >
              <RefreshCcw
                className={`h-4 w-4 ${isFetchingModels ? "animate-spin" : ""}`}
              />
            </ResetButton>
          </div>
        </div>
      )}
    </>
  );

  return (
    <SettingContainer
      title={t("settings.postProcessing.prompts.selectedPrompt.title")}
      description={t(
        "settings.postProcessing.prompts.selectedPrompt.description",
      )}
      descriptionMode="tooltip"
      layout="stacked"
      grouped={true}
    >
      <div className="space-y-3">
        <div className="flex gap-2">
          <Dropdown
            selectedValue={selectedPromptId || null}
            options={prompts.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            onSelect={(value) => handlePromptSelect(value)}
            placeholder={
              prompts.length === 0
                ? t("settings.postProcessing.prompts.noPrompts")
                : t("settings.postProcessing.prompts.selectPrompt")
            }
            disabled={
              isUpdating("post_process_selected_prompt_id") || isCreating
            }
            className="flex-1"
          />
          <Button
            onClick={handleStartCreate}
            variant="primary"
            size="md"
            disabled={isCreating}
          >
            {t("settings.postProcessing.prompts.createNew")}
          </Button>
        </div>

        {!isCreating && hasPrompts && selectedPrompt && (
          <div className="space-y-3">
            {promptEditorFields}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleUpdatePrompt}
                variant="primary"
                size="md"
                disabled={!draftName.trim() || !draftText.trim() || !isDirty}
              >
                {t("settings.postProcessing.prompts.updatePrompt")}
              </Button>
              <Button
                onClick={() => handleDeletePrompt(selectedPromptId)}
                variant="secondary"
                size="md"
                disabled={!selectedPromptId || prompts.length <= 1}
              >
                {t("settings.postProcessing.prompts.deletePrompt")}
              </Button>
            </div>
          </div>
        )}

        {!isCreating && !selectedPrompt && (
          <div className="p-3 bg-mid-gray/5 rounded-md border border-mid-gray/20">
            <p className="text-sm text-mid-gray">
              {hasPrompts
                ? t("settings.postProcessing.prompts.selectToEdit")
                : t("settings.postProcessing.prompts.createFirst")}
            </p>
          </div>
        )}

        {isCreating && (
          <div className="space-y-3">
            {promptEditorFields}
            <div className="flex gap-2 pt-2">
              <Button
                onClick={handleCreatePrompt}
                variant="primary"
                size="md"
                disabled={!draftName.trim() || !draftText.trim()}
              >
                {t("settings.postProcessing.prompts.createPrompt")}
              </Button>
              <Button
                onClick={handleCancelCreate}
                variant="secondary"
                size="md"
              >
                {t("settings.postProcessing.prompts.cancel")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </SettingContainer>
  );
};

export const PostProcessingSettingsApi = React.memo(
  PostProcessingSettingsApiComponent,
);
PostProcessingSettingsApi.displayName = "PostProcessingSettingsApi";

export const PostProcessingSettingsPrompts = React.memo(
  PostProcessingSettingsPromptsComponent,
);
PostProcessingSettingsPrompts.displayName = "PostProcessingSettingsPrompts";

export const PostProcessingSettings: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="max-w-3xl w-full mx-auto space-y-6">
      <SettingsGroup title={t("settings.postProcessing.hotkey.title")}>
        <ShortcutInput
          shortcutId="transcribe_with_post_process"
          descriptionMode="tooltip"
          grouped={true}
        />
      </SettingsGroup>

      <SettingsGroup title={t("settings.postProcessing.api.title")}>
        <PostProcessingSettingsApi />
      </SettingsGroup>

      <SettingsGroup title={t("settings.postProcessing.prompts.title")}>
        <PostProcessingSettingsPrompts />
      </SettingsGroup>
    </div>
  );
};

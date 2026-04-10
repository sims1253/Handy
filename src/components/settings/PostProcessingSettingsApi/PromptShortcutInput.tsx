import React, { useEffect, useState, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  getKeyName,
  formatKeyCombination,
  normalizeKey,
} from "../../../lib/utils/keyboard";
import { Button } from "../../ui/Button";
import { useOsType } from "../../../hooks/useOsType";

interface PromptShortcutInputProps {
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}

export const PromptShortcutInput: React.FC<PromptShortcutInputProps> = ({
  value,
  onChange,
  className = "",
}) => {
  const { t } = useTranslation();
  const osType = useOsType();
  const [isRecording, setIsRecording] = useState(false);
  const [keyPressed, setKeyPressed] = useState<string[]>([]);
  const [recordedKeys, setRecordedKeys] = useState<string[]>([]);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const handleStartRecording = useCallback(() => {
    setIsRecording(true);
    setKeyPressed([]);
    setRecordedKeys([]);
  }, []);

  const handleCancel = useCallback(() => {
    setIsRecording(false);
    setKeyPressed([]);
    setRecordedKeys([]);
  }, []);

  const handleClear = useCallback(() => {
    onChange(null);
  }, [onChange]);

  useEffect(() => {
    if (!isRecording) return;

    let cleanup = false;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (cleanup) return;
      if (e.repeat) return;
      e.preventDefault();

      const rawKey = getKeyName(e, osType);
      const key = normalizeKey(rawKey);

      setKeyPressed((prev) => {
        if (prev.includes(key)) return prev;
        const next = [...prev, key];
        setRecordedKeys((prevRec) =>
          prevRec.includes(key) ? prevRec : [...prevRec, key],
        );
        return next;
      });
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (cleanup) return;
      e.preventDefault();

      const rawKey = getKeyName(e, osType);
      const key = normalizeKey(rawKey);

      setKeyPressed((prev) => {
        const updated = prev.filter((k) => k !== key);
        if (updated.length === 0 && recordedKeys.length > 0) {
          const modifiers = [
            "ctrl",
            "control",
            "shift",
            "alt",
            "option",
            "meta",
            "command",
            "cmd",
            "super",
            "win",
            "windows",
          ];
          const sorted = [...recordedKeys].sort((a, b) => {
            const aMod = modifiers.includes(a.toLowerCase()) ? 0 : 1;
            const bMod = modifiers.includes(b.toLowerCase()) ? 0 : 1;
            return aMod - bMod;
          });
          const shortcut = sorted.join("+");
          onChange(shortcut || null);
          setIsRecording(false);
          setRecordedKeys([]);
        }
        return updated;
      });
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (cleanup) return;
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        handleCancel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("click", handleClickOutside);

    return () => {
      cleanup = true;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [isRecording, keyPressed, recordedKeys, onChange, osType, handleCancel]);

  return (
    <div
      ref={containerRef}
      className={`flex items-center gap-2 max-w-[380px] ${className}`}
    >
      {isRecording ? (
        <div className="flex items-center gap-2 flex-1">
          <div className="px-3 py-1.5 text-sm font-semibold border border-logo-primary bg-logo-primary/30 rounded-md flex-1 text-center">
            {recordedKeys.length > 0
              ? formatKeyCombination(recordedKeys.join("+"), osType)
              : t("settings.postProcessing.prompts.shortcut.pressKeys")}
          </div>
          <Button onClick={handleCancel} variant="secondary" size="sm">
            {t("settings.postProcessing.prompts.shortcut.cancelRecording")}
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 flex-1">
          <div
            className="px-3 py-1.5 text-sm font-semibold bg-mid-gray/10 border border-mid-gray/80 hover:bg-logo-primary/10 rounded-md cursor-pointer hover:border-logo-primary flex-1 text-center"
            onClick={handleStartRecording}
          >
            {value
              ? formatKeyCombination(value, osType)
              : t("settings.postProcessing.prompts.shortcut.placeholder")}
          </div>
          {value && (
            <Button onClick={handleClear} variant="secondary" size="sm">
              {t("settings.postProcessing.prompts.shortcut.clear")}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

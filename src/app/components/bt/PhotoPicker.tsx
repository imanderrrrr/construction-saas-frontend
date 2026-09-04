import { useEffect, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../ui/utils';
import { FOCUS_RING } from '../onboarding/chrome';
import { FieldHint, Mono } from '../projects/bt';

/**
 * Photo picker of the fase-3 forms: "Fotos · 2 de 5", 56 px squares with the
 * real thumbnails, a dashed "+" square while there is room, and the limits as
 * a mono hint. The caller passes its own namespace's messages so the punch
 * list and the RFIs keep their copy.
 */

export interface PickerMessages {
  invalidType: string;
  tooLarge: string;
  tooMany: string;
}

export function usePhotoPicker(max: number, maxBytes: number, messages: PickerMessages) {
  const [photos, setPhotos] = useState<File[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    setPhotos((prev) => {
      const next = [...prev];
      for (const file of Array.from(list)) {
        if (!file.type.startsWith('image/')) {
          toast.error(messages.invalidType);
          continue;
        }
        if (file.size > maxBytes) {
          toast.error(messages.tooLarge);
          continue;
        }
        if (next.length >= max) {
          toast.error(messages.tooMany);
          break;
        }
        next.push(file);
      }
      return next;
    });
    if (inputRef.current) inputRef.current.value = '';
  };

  return { photos, setPhotos, inputRef, addFiles, max };
}

export type PhotoPicker = ReturnType<typeof usePhotoPicker>;

function FileThumb({ file, onRemove, removeLabel, size }: { file: File; onRemove: () => void; removeLabel: string; size: number }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <span className="relative flex-shrink-0 border border-[#DBD0BB] bg-[#F3EEE4] overflow-hidden" style={{ width: size, height: size }}>
      {url && <img src={url} alt={file.name} className="w-full h-full object-cover" />}
      <button
        type="button"
        onClick={onRemove}
        aria-label={`${removeLabel}: ${file.name}`}
        className={cn('absolute top-0 right-0 w-[18px] h-[18px] bg-[#0A0A0A] text-[#F5F1E8] flex items-center justify-center hover:bg-[#B3402A]', FOCUS_RING)}
      >
        <X className="w-2.5 h-2.5" strokeWidth={2.5} />
      </button>
    </span>
  );
}

export function PhotoGrid({ picker, label, hint, removeLabel, addLabel, size = 56, className }: {
  picker: PhotoPicker;
  /** "Fotos · 2 de 5" — already counted by the caller. */
  label: string;
  hint?: string;
  removeLabel: string;
  addLabel: string;
  size?: number;
  className?: string;
}) {
  const full = picker.photos.length >= picker.max;
  return (
    <div className={className}>
      <Mono className="block text-[10px] font-semibold tracking-[0.12em] text-[#5A5346] mb-1.5">{label}</Mono>
      <div className="flex flex-wrap gap-2">
        {picker.photos.map((file, i) => (
          <FileThumb
            key={`${file.name}-${i}`}
            file={file}
            size={size}
            removeLabel={removeLabel}
            onRemove={() => picker.setPhotos((prev) => prev.filter((_, idx) => idx !== i))}
          />
        ))}
        {!full && (
          <button
            type="button"
            onClick={() => picker.inputRef.current?.click()}
            aria-label={addLabel}
            className={cn('flex-shrink-0 border border-dashed border-[#CDBFA6] text-[#8A8175] hover:border-[#F97316] hover:text-[#C2410C] flex items-center justify-center transition-colors', FOCUS_RING)}
            style={{ width: size, height: size }}
          >
            <Plus className="w-4 h-4" strokeWidth={2} />
          </button>
        )}
      </div>
      {hint && <FieldHint>{hint}</FieldHint>}
      <input
        ref={picker.inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => picker.addFiles(e.target.files)}
      />
    </div>
  );
}

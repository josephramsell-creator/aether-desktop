import * as SliderPrimitive from "@radix-ui/react-slider";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function Slider({ className, ...props }: ComponentProps<typeof SliderPrimitive.Root>) {
  return (
    <SliderPrimitive.Root
      className={cn(
        "relative flex w-full touch-none items-center select-none data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-border">
        <SliderPrimitive.Range className="absolute h-full bg-gilt" />
      </SliderPrimitive.Track>
      <SliderPrimitive.Thumb className="block size-4 rounded-full border border-gilt bg-fg shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gilt/70" />
    </SliderPrimitive.Root>
  );
}

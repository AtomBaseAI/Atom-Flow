import * as React from "react"
import { cn } from "@/lib/utils"

interface CustomSeparatorProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "horizontal" | "vertical"
  color?: string
  thickness?: "thin" | "medium" | "thick" | "extra-thick"
  length?: string
  decorative?: boolean
}

const CustomSeparator = React.forwardRef<HTMLDivElement, CustomSeparatorProps>(
  (
    {
      className,
      orientation = "horizontal",
      color = "bg-border",
      thickness = "thin",
      length,
      decorative = true,
      ...props
    },
    ref,
  ) => {
    const getThicknessClass = () => {
      const thicknessMap = {
        thin: "1px",
        medium: "2px",
        thick: "4px",
        "extra-thick": "8px",
      }

      if (orientation === "horizontal") {
        return {
          height: thicknessMap[thickness],
          width: length || "100%",
        }
      } else {
        return {
          width: thicknessMap[thickness],
          height: length || "100%",
        }
      }
    }

    const orientationClasses = orientation === "horizontal" ? "w-full" : "h-full min-h-4"

    return (
      <div
        ref={ref}
        role={decorative ? "none" : "separator"}
        aria-orientation={decorative ? undefined : orientation}
        className={cn("shrink-0", color, orientationClasses, className)}
        style={getThicknessClass()}
        {...props}
      />
    )
  },
)

CustomSeparator.displayName = "CustomSeparator"

export { CustomSeparator }

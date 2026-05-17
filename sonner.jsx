import * as React from "react"
import { cn } from "@/lib/utils"

function Separator({
  className,
  orientation = "horizontal",
  ...props
}) {
  return (
    <div
      className={cn(
        "shrink-0 bg-border",
        orientation === "horizontal" ? "h-[1px] w-full" : "w-[1px] h-full",
        className
      )}
      {...props}
    />
  )
}

export { Separator }

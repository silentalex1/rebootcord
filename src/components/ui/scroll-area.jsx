import * as React from "react"
import { cn } from "@/lib/utils"

function ScrollArea({ className, children, ...props }) {
  return (
    <div
      className={cn("relative overflow-auto custom-scrollbar", className)}
      {...props}
    >
      {children}
    </div>
  )
}

function ScrollBar({ className, orientation = "vertical", ...props }) {
  return null // Simplified
}

export { ScrollArea, ScrollBar }

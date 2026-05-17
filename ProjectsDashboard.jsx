import * as React from "react"
import { cn } from "@/lib/utils"

const TabsContext = React.createContext(null)

const Tabs = ({ defaultValue, children, className, ...props }) => {
  const [value, setValue] = React.useState(defaultValue)
  return (
    <TabsContext.Provider value={{ value, setValue }}>
      <div className={cn("flex flex-col gap-2", className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  )
}

const TabsList = ({ children, className, ...props }) => (
  <div className={cn("inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground", className)} {...props}>
    {children}
  </div>
)

const TabsTrigger = ({ value: triggerValue, children, className, ...props }) => {
  const context = React.useContext(TabsContext)
  if (!context) return null
  const { value: activeValue, setValue } = context
  
  return (
    <button
      onClick={() => setValue(triggerValue)}
      className={cn(
        "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        activeValue === triggerValue ? "bg-background text-foreground shadow-sm" : "hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  )
}

const TabsContent = ({ value: contentValue, children, className, ...props }) => {
  const context = React.useContext(TabsContext)
  if (!context) return null
  const { value: activeValue } = context

  if (activeValue !== contentValue) return null
  
  return (
    <div className={cn("mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)} {...props}>
      {children}
    </div>
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }

import * as React from "react"
import { Command as Cmdk } from "cmdk"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Search } from "lucide-react"
import { cn } from "@/lib/utils"

const Command = React.forwardRef(({ className, ...props }, ref) => (
  <Cmdk
    ref={ref}
    className={cn("flex w-full flex-col overflow-hidden rounded-xl bg-popover text-popover-foreground", className)}
    {...props}
  />
))
Command.displayName = "Command"

/** Modal command palette. Control `open` yourself (bound to Ctrl/Cmd+K in the app shell). */
function CommandDialog({ open, onOpenChange, children, label = "Command palette", ...props }) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[16%] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl outline-none animate-pop"
        >
          <DialogPrimitive.Title className="sr-only">{label}</DialogPrimitive.Title>
          <Command loop {...props}>{children}</Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

const CommandInput = React.forwardRef(({ className, ...props }, ref) => (
  <div className="flex items-center gap-2.5 border-b px-4">
    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
    <Cmdk.Input
      ref={ref}
      className={cn("h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/70", className)}
      {...props}
    />
  </div>
))
CommandInput.displayName = "CommandInput"

const CommandList = ({ className, ...props }) => (
  <Cmdk.List className={cn("max-h-80 overflow-y-auto p-2", className)} {...props} />
)
const CommandEmpty = (props) => (
  <Cmdk.Empty className="py-10 text-center text-[13px] text-muted-foreground" {...props} />
)
const CommandGroup = ({ className, ...props }) => (
  <Cmdk.Group
    className={cn(
      "[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-muted-foreground",
      className
    )}
    {...props}
  />
)
const CommandItem = ({ className, ...props }) => (
  <Cmdk.Item
    className={cn(
      "flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-[13px] outline-none data-[selected=true]:bg-secondary [&_svg]:h-4 [&_svg]:w-4 [&_svg]:text-muted-foreground",
      className
    )}
    {...props}
  />
)

export { Command, CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem }

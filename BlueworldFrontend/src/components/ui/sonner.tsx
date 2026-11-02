import { Toaster as Sonner } from "sonner";
import { useCmsTheme } from "@/hooks/use-cms-theme";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  // Follow the CMS light/dark switch (not the phone's system setting), so toasts never clash with the page.
  const { theme } = useCmsTheme();
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      mobileOffset={{ bottom: "calc(env(safe-area-inset-bottom) + 16px)", left: 16, right: 16 }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
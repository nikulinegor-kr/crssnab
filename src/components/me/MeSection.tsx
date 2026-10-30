import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
export function MeSection({title,link,loading,error,children,rows=3}:{title:string;link?:string;loading?:boolean;error?:boolean;children:ReactNode;rows?:number}){
 return <section className="min-w-0 rounded-lg border border-border bg-card p-4"><header className="mb-2 flex min-h-11 items-center justify-between gap-2"><h2 className="text-[15px] font-semibold">{title}</h2>{link&&<Button asChild variant="link" className="min-h-11 px-0 text-xs text-muted-foreground"><Link to={link}>Все →</Link></Button>}</header>
 {loading?<div className="space-y-2">{Array.from({length:rows},(_,i)=><Skeleton key={i} className="h-14 w-full"/>)}</div>:error?<p role="alert" className="py-4 text-sm text-muted-foreground">Не удалось загрузить</p>:children}</section>;
}
export const MeEmpty=({children}:{children:ReactNode})=><p className="py-4 text-sm text-muted-foreground">{children}</p>;

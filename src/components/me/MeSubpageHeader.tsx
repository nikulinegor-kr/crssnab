import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
export function MeSubpageHeader({title}:{title:string}){return <header className="flex min-h-11 items-center gap-3"><Button variant="ghost" size="icon" asChild className="h-11 w-11" aria-label="Назад"><Link to="/me"><ArrowLeft/></Link></Button><h1 className="text-xl font-semibold">{title}</h1></header>;}

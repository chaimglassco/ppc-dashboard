import { getDocumentBySlug, getPublishedDocuments } from "@/features/library/data/repository";
import { ManagedReader } from "@/features/library/ui/managed-reader";

export function generateStaticParams() { return getPublishedDocuments().map(document => ({ slug: document.slug })); }
export default async function Page({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <div className="reader-page"><ManagedReader slug={slug} fallback={getDocumentBySlug(slug)}/></div>; }

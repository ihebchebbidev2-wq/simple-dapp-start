import React, { useEffect, useState } from 'react';
import { useCMSPageContent } from '@/hooks/useCMS';

interface CMSSectionProps {
  pageName: string;
  sectionKey: string;
  defaultTitle?: string;
  defaultDescription?: string;
  defaultContent?: string;
  defaultImage?: string;
  as?: 'section' | 'div' | 'article' | 'header' | 'footer';
  className?: string;
  renderContent?: (content: any) => React.ReactNode;
}

export default function CMSSection({
  pageName,
  sectionKey,
  defaultTitle,
  defaultDescription,
  defaultContent,
  defaultImage,
  as: Component = 'section',
  className = '',
  renderContent,
}: CMSSectionProps) {
  const { data: pageContent = [] } = useCMSPageContent(pageName);
  const [content, setContent] = useState<any>({
    title: defaultTitle,
    description: defaultDescription,
    content: defaultContent,
    image_url: defaultImage,
  });

  useEffect(() => {
    const sectionContent = pageContent.find((item: any) => item.section_key === sectionKey);
    if (sectionContent) {
      setContent(sectionContent);
    } else {
      setContent({
        title: defaultTitle,
        description: defaultDescription,
        content: defaultContent,
        image_url: defaultImage,
      });
    }
  }, [pageContent, sectionKey, defaultTitle, defaultDescription, defaultContent, defaultImage]);

  if (renderContent) {
    return <Component className={className}>{renderContent(content)}</Component>;
  }

  return (
    <Component className={className}>
      {content.image_url && (
        <img src={content.image_url} alt={content.title} className="w-full object-cover" />
      )}
      {content.title && <h2 className="text-2xl font-bold">{content.title}</h2>}
      {content.description && <p className="text-gray-600">{content.description}</p>}
      {content.content && <div className="whitespace-pre-wrap">{content.content}</div>}
    </Component>
  );
}

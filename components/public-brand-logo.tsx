import Image from "next/image";

type Props = {
  priority?: boolean;
};

export function PublicBrandLogo({ priority = false }: Props) {
  return (
    <span className="public-brand-wordmark">
      <Image
        src="/hero/vyskerlogo.png"
        alt="Vyskeř"
        width={244}
        height={98}
        priority={priority}
        className="public-brand-wordmark-image"
      />
    </span>
  );
}

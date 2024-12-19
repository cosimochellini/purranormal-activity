import classNames from "classnames";
import Image from "next/image";

interface EventCardProps {
  title: string;
  description: string;
  imageUrl?: string;
  imageAlt?: string;
}
const cardClasses = classNames(
    "bg-purple-900/30 backdrop-blur-sm rounded-lg p-6",
    "hover:transform hover:scale-[1.02] transition-all duration-300",
    "hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]",
    "border border-purple-700/30",
    "group"
  );

export const EventCard = ({
  title,
  description,
  imageUrl = "/ghost-paw.svg",
  imageAlt = "Ghost Paw"
}: EventCardProps) => {

  return (
    <div className={cardClasses}>
      <div className="relative">
        <Image
          src={imageUrl}
          alt={imageAlt}
          width={24}
          height={24}
          className="mb-4 group-hover:animate-spooky-shake"
          priority={false}
        />
        <div
          className="absolute -inset-1 bg-purple-500/20 blur-sm
            group-hover:animate-pulse rounded-full"
        />
      </div>
      <h3 className="font-medium mb-2 group-hover:text-purple-300 transition-colors">
        {title}
      </h3>
      <p className="text-purple-200/80">{description}</p>
    </div>
  );
};

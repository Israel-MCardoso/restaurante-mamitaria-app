export interface PriceOverrideOptionGroupLike {
  id: string;
  name: string;
  min_select?: number | null;
  max_select?: number | null;
  is_price_override?: boolean | null;
}

export interface PriceOverrideOptionItemLike {
  option_id: string;
  price_adjustment: number;
}

function normalizeOptionGroupName(name: string | null | undefined) {
  return (name ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function isPriceOverrideOptionGroup(optionGroup: Pick<PriceOverrideOptionGroupLike, 'name' | 'is_price_override'>) {
  return optionGroup.is_price_override === true || normalizeOptionGroupName(optionGroup.name).includes('tamanho');
}

export function resolvePriceOverride(
  optionGroups: PriceOverrideOptionGroupLike[],
  selectedItems: PriceOverrideOptionItemLike[],
) {
  const overrideGroups = optionGroups.filter(isPriceOverrideOptionGroup);

  if (overrideGroups.length > 1) {
    throw new Error('Only one price override option group is allowed per product.');
  }

  const overrideGroup = overrideGroups[0] ?? null;

  if (!overrideGroup) {
    return {
      overrideGroup: null,
      overrideItem: null,
      overridePrice: null,
      additionalOptionsTotal: selectedItems.reduce((sum, item) => sum + item.price_adjustment, 0),
    };
  }

  const overrideItems = selectedItems.filter((item) => item.option_id === overrideGroup.id);

  if (overrideItems.length > 1) {
    throw new Error('Price override option group must have exactly one selected item.');
  }

  const overrideItem = overrideItems[0] ?? null;
  const additionalOptionsTotal = selectedItems
    .filter((item) => item.option_id !== overrideGroup.id)
    .reduce((sum, item) => sum + item.price_adjustment, 0);

  return {
    overrideGroup,
    overrideItem,
    overridePrice: overrideItem?.price_adjustment ?? null,
    additionalOptionsTotal,
  };
}

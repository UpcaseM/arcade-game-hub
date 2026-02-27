export interface WeightedItem {
  weight: number;
}

export function choiceWeighted<T extends WeightedItem>(items: T[], pickCount: number): T[] {
  const remaining = [...items];
  const picks: T[] = [];

  while (remaining.length > 0 && picks.length < pickCount) {
    let totalWeight = 0;

    for (let index = 0; index < remaining.length; index += 1) {
      totalWeight += Math.max(0.001, remaining[index].weight);
    }

    let marker = Math.random() * totalWeight;
    let selectedIndex = remaining.length - 1;

    for (let index = 0; index < remaining.length; index += 1) {
      marker -= Math.max(0.001, remaining[index].weight);

      if (marker <= 0) {
        selectedIndex = index;
        break;
      }
    }

    picks.push(remaining[selectedIndex]);
    remaining.splice(selectedIndex, 1);
  }

  return picks;
}

export const combineClasses = (...classes: (string | false | undefined)[]) => {
    return classes.filter(Boolean).join(' ');
};
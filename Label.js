import { View, StyleSheet } from "react-native";
import { StyleGuide } from "./components/StyleGuide";
import { ReText } from "react-native-redash";
import { useDerivedValue } from "react-native-reanimated";

const styles = StyleSheet.create({
    date: {
        ...StyleGuide.typography.title3,
        textAlign: "center",
    },
    price: {
        ...StyleGuide.typography.title2,
        textAlign: "center",
    },
});

console.log({ styles });

export const Label = ({ point }) => {
    const date = useDerivedValue(() => {
        return new Date(point.value.data.x).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
        });
    })
    const price = useDerivedValue(() => {
        return `$ ${Math.round(point.value.data.y, 2).toLocaleString("en-US", { currency: "USD" })}`
    })
    return (
        <View>
            <ReText style={styles.date} text={date} />
            <ReText style={styles.price} text={price} />
        </View>
    );
};
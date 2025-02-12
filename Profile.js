import { Dimensions, Image, StyleSheet, Text, View } from "react-native";
import Animated, { Extrapolation, interpolate, useAnimatedStyle } from "react-native-reanimated";

const { width, height } = Dimensions.get("window");
export const α = Math.PI / 12;
export const A = Math.sin(α) * height + Math.cos(α) * width;
const styles = StyleSheet.create({
    image: {
        ...StyleSheet.absoluteFillObject,
        width: undefined,
        height: undefined,
        borderRadius: 8,
    },
    overlay: {
        flex: 1,
        justifyContent: "space-between",
        padding: 16,
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
    },
    footer: {
        flexDirection: "row",
    },
    name: {
        color: "white",
        fontSize: 32,
    },
    like: {
        borderWidth: 4,
        borderRadius: 5,
        padding: 8,
        borderColor: "#6ee3b4",
    },
    likeLabel: {
        fontSize: 32,
        color: "#6ee3b4",
        fontWeight: "bold",
    },
    nope: {
        borderWidth: 4,
        borderRadius: 5,
        padding: 8,
        borderColor: "#ec5288",
    },
    nopeLabel: {
        fontSize: 32,
        color: "#ec5288",
        fontWeight: "bold",
    },
});

export const Profile = ({ scale, profile, translateX, translateY }) => {
    const style = useAnimatedStyle(() => {
        return {
            transform: [
                { translateX: translateX.value },
                { translateY: translateY.value },
                { rotate: interpolate(translateX.value, [-width / 2, 0, width / 2], [α, 0, -α], Extrapolation.CLAMP) + " deg" },
                { scale: scale.value }
            ],
        };
    });
    const like = useAnimatedStyle(() => {
        return {
            opacity: interpolate(translateX.value, [0, width / 4], [0, 1], Extrapolation.CLAMP)
        }
    })
    const nope = useAnimatedStyle(() => {
        return {
            opacity: interpolate(translateX.value, [-width / 4, 0], [1, 0], Extrapolation.CLAMP)
        }
    })
    return (
        <Animated.View style={[StyleSheet.absoluteFill, style]}>
            <Image style={styles.image} source={profile.profile} />
            <View style={styles.overlay}>
                <View style={styles.header}>
                    <Animated.View style={[styles.like, like]}>
                        <Text style={styles.likeLabel}>LIKE</Text>
                    </Animated.View>
                    <Animated.View style={[styles.nope, nope]}>
                        <Text style={styles.nopeLabel}>NOPE</Text>
                    </Animated.View>
                </View>
                <View style={styles.footer}>
                    <Text style={styles.name}>{profile.name}</Text>
                </View>
            </View>
        </Animated.View>
    );
};
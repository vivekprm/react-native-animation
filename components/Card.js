import { Dimensions, Image, StyleSheet } from "react-native";

const { width } = Dimensions.get("window");
const ratio = 228 / 362;
export const CARD_WIDTH = width * 0.8;
export const CARD_HEIGHT = CARD_WIDTH * ratio;
export const assets = [
  require("./assets/card1.png"),
  require("./assets/card2.png"),
  require("./assets/card3.png"),
  require("./assets/card4.png"),
  require("./assets/card5.png"),
  require("./assets/card6.png"),
];

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    borderRadius: 16,
  },
});

export let Cards;
(function (Cards) {
  Cards[(Cards["Card1"] = 0)] = "Card1";
  Cards[(Cards["Card2"] = 1)] = "Card2";
  Cards[(Cards["Card3"] = 2)] = "Card3";
  Cards[(Cards["Card4"] = 3)] = "Card4";
  Cards[(Cards["Card5"] = 4)] = "Card5";
  Cards[(Cards["Card6"] = 5)] = "Card6";
})(Cards || (Cards = {}));

export const cards = [
  Cards.Card1,
  Cards.Card2,
  Cards.Card3,
  Cards.Card4,
  Cards.Card5,
  Cards.Card6,
];

export const Card = ({ card }) => {
  return <Image style={styles.card} source={assets[card]} />;
};

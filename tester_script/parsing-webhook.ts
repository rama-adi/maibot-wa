import { Fonnte } from "@/services/fonnte";

async function main() {
    const whservice = new Fonnte({
        phoneNumber: "6287787505413",
        apiKey: "1234567890"
    });

    const FONNTE_GROUP_MSG = `{"quick":false,"device":"6287787505413","pesan":"@6287787505413 minfo Cider party","pengirim":"120363400835772540@g.us","member":"6282147077374","message":"@6287787505413 minfo Cider party","text":"non-button message","sender":"120363400835772540@g.us","name":"Rama Adi Nugraha","location":"","url":"","type":"text","extension":"","filename":"","pollname":"","choices":[],"inboxid":0,"isgroup":true,"isforwarded":false}`

    const group_wh_result = await whservice.handleWebhook(FONNTE_GROUP_MSG);
    console.log("Group webhook result:", group_wh_result);

    const FONNTE_PRIVATE_MSG = `{"quick":false,"device":"6287787505413","pesan":"Halo","pengirim":"6282147077374","member":"","message":"Halo","text":"non-button message","sender":"6282147077374","name":"Rama Adi Nugraha","location":"","url":"","type":"text","extension":"","filename":"","pollname":"","choices":[],"inboxid":0,"isgroup":false,"isforwarded":false}`

    const private_wh_result = await whservice.handleWebhook(FONNTE_PRIVATE_MSG);
    console.log("Private webhook result:", private_wh_result);
}

main();
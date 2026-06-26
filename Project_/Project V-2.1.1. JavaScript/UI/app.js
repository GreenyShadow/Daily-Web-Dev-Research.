const views = [
    "dashboard",
    "submit",
    "tickets"
];

const form =
document.getElementById(
    "ticket-form"
);

const ticketList =
document.getElementById(
    "ticket-list"
);

const stats =
document.getElementById(
    "stats"
);



function showView(viewID){

    views.forEach(view=>{

        document
        .getElementById(view)
        .classList
        .add("hidden");

    });

    document
    .getElementById(viewID)
    .classList
    .remove("hidden");

}



document
.querySelectorAll("[data-view]")
.forEach(button=>{

    button.onclick=()=>{

        showView(
            button.dataset.view
        );

    };

});



function getTickets(){

    return JSON.parse(

        localStorage.getItem(
            "tickets"
        ) || "[]"

    );

}



function saveTickets(data){

    localStorage.setItem(
        "tickets",
        JSON.stringify(data)
    );

}



function escapeHTML(text=""){

    const div =
    document.createElement(
        "div"
    );

    div.textContent=text;

    return div.innerHTML;

}



function render(){

    const tickets =
    getTickets();

    ticketList.innerHTML="";

    if(tickets.length===0){

        ticketList.innerHTML=
        "<p>No tickets yet.</p>";

    }

    [...tickets]
    .reverse()
    .forEach(ticket=>{

        const element=
        document.createElement(
            "div"
        );

        element.className=
        "ticket";

        element.innerHTML=
        `
        <div class="ticket-title">
            ${escapeHTML(ticket.title)}
        </div>

        <div>
            ${escapeHTML(ticket.description)}
        </div>

        <div class="ticket-meta">
            ${escapeHTML(ticket.name)}
            •
            ${escapeHTML(ticket.priority)}
            •
            ${escapeHTML(ticket.department)}
        </div>
        `;

        ticketList.appendChild(
            element
        );

    });

    stats.innerHTML=
    `
    <h3>
        Total Tickets:
        ${tickets.length}
    </h3>
    `;
}



form.addEventListener(
"submit",
event=>{

event.preventDefault();

const data=
Object.fromEntries(

new FormData(form)

);

data.id=
crypto.randomUUID();

data.createdAt=
new Date()
.toISOString();

const tickets=
getTickets();

tickets.push(data);

saveTickets(
tickets
);

form.reset();

showView(
"tickets"
);

render();

});



render();
---
layout: page
title: U.S. President
permalink: /office/us-president
comments: true
---

### 2020 Elections

{% include 2020-elections.html %}

#### 2020 Presidential Primary Candidates
{% assign people = site.data.people | where: 'election_2020.office' , 'U.S. President' | sort: 'last_names' %}
<table>
<thead>
  <th></th>
  <th>First Name</th>
  <th>Last Name</th>
  <th>Candidate for</th>
  <th>Party</th>
</thead>
<tbody>
{% for member in people  %}
  <tr>
    <td>
      {% if member.image %}
      <a href="{{ site.url }}/people/{{ member.id }}">
        <img class="table-image" src="{{ member.image }}" alt="{{ member.full_name }}">
      </a>
      {% endif %}
    </td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_names }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_names }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.election_2020.office | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.election_2020.office }}</a></td>
    <td><a href="{{ site.url }}/party/{{ member.election_2020.party | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.election_2020.party }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>
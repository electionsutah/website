---
title: U.S. President
permalink: "/office/us-president"
layout: page
comments: true
---

### 2020 Elections

{% include 2020-elections.html %}

#### 2020 Presidential Primary Candidates
{% assign people = site.data.people | where: 2020_election.office, 'U.S. President' | sort: 'last_names' %}
<table>
<thead>
  <th></th>
  <th>First Names</th>
  <th>Last Names</th>
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
    <td><a href="{{ site.url }}/office/{{ member.2020_election.office | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.2020_election.office }}</a></td>
    <td><a href="{{ site.url }}/party/{{ member.2020_election.party | downcase | replace: ' ','-' | replace: '.','' }}">{{ member.2020_election.party }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>
---
title: American Fork
permalink: "/places/utah/american-fork/"
layout: page
---

{% assign place = site.data.places.american_fork %}

<section class="info">
  <p><a href="{{ place.wikipedia_url }}">From Wikipedia:</a></p>
  <p class="citation">{{ place.wikipedia_snippet }}</p>
</section>

### 2018 Election

{% include 2018-elections.html %}

#### 2018 Primary Candidates
{% assign city = site.data.2018.primary.candidates | where:'city','American Fork' | sort: 'last_name' %}
<table>
<thead>
  <th>First Names</th>
  <th>Last Names</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in city  %}
  <tr>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_names }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_names }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>

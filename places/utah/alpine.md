---
title: Alpine
permalink: "/places/utah/alpine/"
layout: page
---

{% assign place = site.data.places.alpine %}

<section class="info">
  <p class="citation"><wd-entity id="Q115481" label lang="en"/></p>
  <p>is a <wd-entity id="Q115481" description lang="en"/></p>
</section>

### 2018 Election

{% include 2018-elections.html %}

#### 2018 Primary Candidates
{% assign city = site.data.2018.primary.candidates | where:'city','Alpine' | sort: 'last_name' %}
<table>
<thead>
  <th>First Name</th>
  <th>Last Name</th>
  <th>Candidate for</th>
  <th>City</th>
  <th>County</th>
</thead>
<tbody>
{% for member in city  %}
  <tr>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.first_name }}</a></td>
    <td><a href="{{ site.url }}/people/{{ member.id }}">{{ member.last_name }}</a></td>
    <td><a href="{{ site.url }}/office/{{ member.office | downcase | replace: ' ','-' | replace: '.','' | replace: '(','' | replace: ')','' }}">{{ member.office }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}/{{ member.city | downcase | replace: ' ','-' }}">{{ member.city }}</a></td>
    <td><a href="{{ site.url }}/places/{{ member.county | downcase | replace: ' ','-' }}">{{ member.county }}</a></td>
  </tr>
{% endfor %}
</tbody>
</table>
